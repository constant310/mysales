import {Pool} from 'pg';
import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const {productId,unitId,quantity,requestKey}=req.body||{};
  if(!uuid.test(productId||'')||!uuid.test(unitId||'')||!Number.isSafeInteger(Number(quantity))||Number(quantity)<1||Number(quantity)>100000||typeof requestKey!=='string'||!uuid.test(requestKey))
   return res.status(400).json({error:'Invalid sale request'});
  const result=await pool.query('select early_storefront.record_sale($1,$2,$3,$4,$5) as sale_id',[merchant.store_id,productId,unitId,Number(quantity),requestKey]);
  return res.status(200).json({saleId:result.rows[0].sale_id});
 }catch(e){
  if(/Insufficient stock|Selling unit not found|Invalid sale request/.test(e.message))return res.status(409).json({error:e.message});
  console.error('Confirm sale failed',e.message);
  return res.status(500).json({error:'Unable to confirm sale'});
 }
}
