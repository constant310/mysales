import pg from 'pg';
import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true}});
const isUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const b=req.body||{};
  const text=(s,n)=>typeof s==='string'&&s.length<=n;
  if(!isUuid(b.productId)||!isUuid(b.unitId)||!text(b.name,150)||!b.name.trim()||!text(b.description,2000)||!text(b.category,80)||!text(b.unitName,40)||!b.unitName.trim()||!Number.isSafeInteger(b.factor)||b.factor<1||b.factor>1000000||!Number.isSafeInteger(b.price)||b.price<0||b.price>1000000000000||!text(b.imageUrl||'',2048))
   return res.status(400).json({error:'Invalid product'});
  if(b.imageUrl){try{const u=new URL(b.imageUrl);if(u.protocol!=='https:'||u.username||u.password||!u.hostname||['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error();}catch{return res.status(400).json({error:'Image must be an HTTPS URL'});}}
  const db=await pool.connect();
  try{
   await db.query('begin');
   const p=await db.query('update early_storefront.products set name=$3,description=$4,category=$5,image_path=$6 where store_id=$1 and id=$2 and archived_at is null returning id',[merchant.store_id,b.productId,b.name.trim(),b.description,b.category.trim(),b.imageUrl||null]);
   if(!p.rowCount){await db.query('rollback');return res.status(404).json({error:'Product not found'});}
   const u=await db.query('update early_storefront.units set name=$4,factor=$5,price_ngn=$6 where store_id=$1 and product_id=$2 and id=$3 returning id',[merchant.store_id,b.productId,b.unitId,b.unitName.trim(),b.factor,b.price]);
   if(!u.rowCount){await db.query('rollback');return res.status(404).json({error:'Selling unit not found'});}
   await db.query('commit');
   return res.status(200).json({ok:true,id:b.productId});
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
 }catch(e){console.error('Edit product failed',e.message);return res.status(500).json({error:'Unable to edit product'});}
}
