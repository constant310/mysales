import pg from 'pg';
import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true},max:4});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supported=['image/webp','image/jpeg','image/png'];
function magicMatches(b,type){
 if(!Buffer.isBuffer(b)||!b.length)return false;
 if(type==='image/webp')return b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(type==='image/jpeg')return b.length>=4&&b[0]===0xff&&b[1]===0xd8&&b[b.length-2]===0xff&&b[b.length-1]===0xd9;
 if(type==='image/png')return b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 return false;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['POST','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private management link required'});
  const id=String(req.query.productId||'');
  if(!uuid.test(id))return res.status(400).json({error:'Invalid product'});
  if(req.method==='DELETE'){
   await pool.query('DELETE FROM early_storefront.product_images WHERE store_id=$1 AND product_id=$2',[merchant.store_id,id]);
   return res.status(200).json({ok:true});
  }
  const contentType=String(req.headers['content-type']||'').toLowerCase().trim();
  const buffer=req.bodyBuffer;
  if(!supported.includes(contentType)||!magicMatches(buffer,contentType)||
      buffer.length>184320)
    return res.status(400).json({error:'Please choose a WebP, JPG or PNG image below 180 KB'});
  const result=await pool.query(`INSERT INTO early_storefront.product_images(store_id,product_id,content_type,image_data)
   SELECT p.store_id,p.id,$3,$4 FROM early_storefront.products p
   WHERE p.store_id=$1 AND p.id=$2 AND p.archived_at IS NULL
   ON CONFLICT(store_id,product_id)
   DO UPDATE SET content_type=EXCLUDED.content_type,image_data=EXCLUDED.image_data,uploaded_at=now()
   RETURNING product_id`,[merchant.store_id,id,contentType,buffer]);
  if(!result.rowCount)return res.status(404).json({error:'Product not found'});
  return res.status(200).json({ok:true});
 }catch(e){console.error('Merchant photo update failed',e.message);return res.status(500).json({error:'Photo could not be saved'});}
}
