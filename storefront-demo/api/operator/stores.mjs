import pg from 'pg';
import {operatorFromRequest} from '../../server/operator-access.mjs';
import {issueManagementLink,revokeStoreManagementAccess} from '../../server/management-links.mjs';
import {safeOrigin} from '../../server/http-auth.mjs';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,max:4,ssl:{rejectUnauthorized:true}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(req.method==='POST'&&!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  if(!await operatorFromRequest(req))return res.status(401).json({error:'Private operator access required'});
  if(req.method==='GET'){
   const {rows}=await pool.query(`SELECT s.id,s.slug,s.name,s.description,s.whatsapp,s.status,s.created_at,
    (SELECT count(*)::int FROM early_storefront.products p WHERE p.store_id=s.id) AS product_count
    FROM early_storefront.stores s ORDER BY s.created_at DESC LIMIT 250`);
   return res.status(200).json({stores:rows});
  }
  const input=req.body||{},action=input.action;
  const origin='https://'+req.headers.host;
  if(action==='create'){
   const {slug,name,whatsapp,description=''}=input;
   if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80||
      typeof name!=='string'||!name.trim()||name.length>150||typeof description!=='string'||description.length>2000||
      typeof whatsapp!=='string'||!/^\+?[1-9]\d{7,14}$/.test(whatsapp))
    return res.status(400).json({error:'Check the store name, slug and WhatsApp number'});
   const {rows}=await pool.query(`INSERT INTO early_storefront.stores(slug,name,whatsapp,description,status)
    VALUES($1,$2,$3,$4,'published') RETURNING id,slug,name`,[slug,name.trim(),whatsapp,description]);
   const store=rows[0];
   const link=await issueManagementLink(store.id,origin);
   return res.status(201).json({store,publicUrl:'/s/?slug='+encodeURIComponent(store.slug),managementLink:link});
  }
  if(action==='rotate'){
   if(!uuid.test(input.storeId||''))return res.status(400).json({error:'Invalid store'});
   const found=await pool.query('SELECT id,slug FROM early_storefront.stores WHERE id=$1',[input.storeId]);
   if(!found.rowCount)return res.status(404).json({error:'Store not found'});
   await revokeStoreManagementAccess(input.storeId);
   const link=await issueManagementLink(input.storeId,origin);
   return res.status(200).json({storeId:input.storeId,managementLink:link});
  }
  if(action==='publish-store'){
   if(!uuid.test(input.storeId||'')||typeof input.published!=='boolean')return res.status(400).json({error:'Invalid store request'});
   const {rows}=await pool.query(`UPDATE early_storefront.stores SET status=$2 WHERE id=$1
    RETURNING id,status`,[input.storeId,input.published?'published':'draft']);
   if(!rows.length)return res.status(404).json({error:'Store not found'});
   return res.status(200).json(rows[0]);
  }
  return res.status(400).json({error:'Unknown action'});
 }catch(e){
  if(e.code==='23505')return res.status(409).json({error:'That storefront slug is already in use'});
  console.error('Operator store action failed',e.message);
  return res.status(500).json({error:'Unable to manage storefronts'});
 }
}
