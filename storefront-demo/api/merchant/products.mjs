import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
import {products,addProduct} from '../../server/catalogue.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(req.method==='POST'&&!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  if(req.method==='GET')return res.status(200).json({products:await products(merchant.store_id)});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'JSON required'});
  const created=await addProduct(merchant.store_id,req.body||{});
  return res.status(201).json(created);
 }catch(e){if(e.message==='Invalid product')return res.status(400).json({error:e.message});console.error('Products API failure',e.message);return res.status(500).json({error:'Unable to process products'});}
}
