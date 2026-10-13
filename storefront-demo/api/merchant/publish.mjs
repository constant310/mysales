import pg from 'pg';
const {Pool} = pg;
import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const {productId,published}=req.body||{};
  if(!/^[0-9a-f-]{36}$/i.test(productId)||typeof published!=='boolean')return res.status(400).json({error:'Invalid request'});
  const result=await pool.query('update early_storefront.products set published=$3 where store_id=$1 and id=$2 returning id,published',[merchant.store_id,productId,published]);
  if(!result.rowCount)return res.status(404).json({error:'Product not found'});
  return res.status(200).json(result.rows[0]);
 }catch(e){console.error('Publish error',e.message);return res.status(500).json({error:'Unable to update product'});}
}
