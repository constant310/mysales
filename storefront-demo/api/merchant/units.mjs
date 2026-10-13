import {merchantFromRequest,safeOrigin} from '../../server/http-auth.mjs';
import {addSellingUnit} from '../../server/catalogue.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{
  const merchant=await merchantFromRequest(req);
  if(!merchant)return res.status(401).json({error:'Private management link required'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'JSON required'});
  return res.status(201).json(await addSellingUnit(merchant.store_id,req.body||{}));
 }catch(e){
  if(e.message==='Invalid selling unit'||e.message.startsWith('Maximum'))return res.status(400).json({error:e.message});
  if(e.message==='Product not found')return res.status(404).json({error:e.message});
  console.error('Selling unit addition failed',e.message);
  return res.status(500).json({error:'Unable to add selling unit'});
 }
}