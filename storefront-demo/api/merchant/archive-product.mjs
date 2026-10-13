import pg from 'pg';
import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const productId=req.body?.productId;
  if(typeof productId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(productId))return res.status(400).json({error:'Invalid product'});
  const r=await pool.query('update early_storefront.products set archived_at=now(),published=false where store_id=$1 and id=$2 and archived_at is null returning id',[merchant.store_id,productId]);
  if(!r.rowCount)return res.status(404).json({error:'Product not found'});
  return res.status(200).json({ok:true,archived:true});
 }catch(e){console.error('Archive failed',e.message);return res.status(500).json({error:'Unable to archive product'});}
}
