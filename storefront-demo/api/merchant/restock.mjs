import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
import {restock} from '../../server/restock.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private access required'});
  const result=await restock(merchant.store_id,req.body?.productId,req.body?.amount);
  return res.status(200).json(result);
 }catch(e){if(['Invalid stock','Product not found'].includes(e.message))return res.status(400).json({error:e.message});console.error('Restock API error',e.message);return res.status(500).json({error:'Unable to restock'});}
}
