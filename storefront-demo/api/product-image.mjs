import pg from 'pg';
import {merchantFromRequest} from '../server/http-auth.mjs';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true},max:4});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const id=String(req.query.id||'');
 if(!uuid.test(id))return res.status(404).end();
 try{
  const {rows}=await pool.query(`SELECT i.store_id,i.content_type,i.image_data,
   p.published,p.archived_at,s.status
   FROM early_storefront.product_images i
   JOIN early_storefront.products p ON p.id=i.product_id AND p.store_id=i.store_id
   JOIN early_storefront.stores s ON s.id=i.store_id
   WHERE i.product_id=$1 LIMIT 1`,[id]);
  if(!rows.length)return res.status(404).end();
  const img=rows[0];
  const isPublic=img.status==='published'&&img.published&&!img.archived_at;
  if(!isPublic){
   const merchant=await merchantFromRequest(req);
   if(!merchant||merchant.store_id!==img.store_id)return res.status(404).end();
  }
  res.setHeader('Content-Type',img.content_type);
  res.setHeader('Content-Length',img.image_data.length);
  return res.status(200).end(img.image_data);
 }catch(e){console.error('Storefront product photo failed',e.message);return res.status(503).end();}
}
