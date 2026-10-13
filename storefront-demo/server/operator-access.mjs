// Internal operator access, independent of merchant accounts.
// Private, reusable bearer links and short-lived secure browser sessions.
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,max:4,ssl:{rejectUnauthorized:true}});
const hash=t=>createHash('sha256').update(t).digest('hex');
const valid=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
const cookieName='__Host-early_storefront_operator';
const cookie=t=>cookieName+'='+t+'; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax';
export const clearOperatorCookie=()=>cookieName+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
export function operatorTokenFromRequest(req){
 const value=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));
 return value?value.slice(cookieName.length+1):null;
}
export async function operatorFromRequest(req){
 const token=operatorTokenFromRequest(req);
 if(!valid(token))return null;
 const {rows}=await pool.query(`SELECT s.link_id FROM early_storefront.operator_sessions s
 JOIN early_storefront.operator_links l ON l.id=s.link_id
 WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND l.revoked_at IS NULL LIMIT 1`,[hash(token)]);
 return rows[0]||null;
}
export async function claimOperatorLink(token){
 if(!valid(token))return null;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query(`UPDATE early_storefront.operator_links SET last_used_at=now()
   WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id`,[hash(token)]);
  if(!rows.length){await client.query('ROLLBACK');return null;}
  const sessionToken=randomBytes(32).toString('base64url');
  await client.query(`INSERT INTO early_storefront.operator_sessions(link_id,token_hash,expires_at)
   VALUES($1,$2,now()+interval '7 days')`,[rows[0].id,hash(sessionToken)]);
  await client.query('COMMIT');
  return cookie(sessionToken);
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
export async function logoutOperator(req){
 const token=operatorTokenFromRequest(req);
 if(valid(token))await pool.query('UPDATE early_storefront.operator_sessions SET revoked_at=now() WHERE token_hash=$1',[hash(token)]);
 return clearOperatorCookie();
}
export async function issueOperatorLink(origin){
 const base=new URL(origin);
 if(base.protocol!=='https:')throw Error('HTTPS origin required');
 const token=randomBytes(32).toString('base64url');
 const {rows}=await pool.query('INSERT INTO early_storefront.operator_links(token_hash) VALUES($1) RETURNING id',[hash(token)]);
 const url=new URL('/operator/claim',base);url.hash='token='+encodeURIComponent(token);
 return {operatorLinkId:rows[0].id,privateOperatorLink:url.toString()};
}
export async function revokeOperatorLink(id){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid operator link ID');
 const client=await pool.connect();
 try{await client.query('BEGIN');
  await client.query('UPDATE early_storefront.operator_links SET revoked_at=now() WHERE id=$1',[id]);
  await client.query('UPDATE early_storefront.operator_sessions SET revoked_at=now() WHERE link_id=$1',[id]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
