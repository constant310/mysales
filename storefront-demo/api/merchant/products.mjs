import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
import {products,addProduct,updateProduct,archiveProduct} from '../../server/catalogue.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(req.method!=='GET'&&!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private management link required'});
  if(req.method==='GET')return res.status(200).json({products:await products(merchant.store_id)});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'JSON required'});
  if(req.method==='POST')return res.status(201).json(await addProduct(merchant.store_id,req.body||{}));
  if(req.method==='PATCH')return res.status(200).json(await updateProduct(merchant.store_id,req.body||{}));
  return res.status(200).json(await archiveProduct(merchant.store_id,req.body?.productId));
 }catch(e){
  if(e.message==='Invalid product')return res.status(400).json({error:e.message});
  if(e.message==='Product not found'||e.message==='Selling unit not found')return res.status(404).json({error:e.message});
  console.error('Merchant catalogue request failed',e.message);
  return res.status(500).json({error:'Unable to manage catalogue'});
 }
}
