import {safeOrigin} from '../../server/http-auth.mjs';
import {claimOperatorLink} from '../../server/operator-access.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 const token=req.body?.token;
 try{
  const cookie=await claimOperatorLink(token);
  if(!cookie)return res.status(401).json({error:'Invalid or revoked operator link'});
  res.setHeader('Set-Cookie',cookie);return res.status(200).json({ok:true});
 }catch(e){console.error('Operator claim failed',e.message);return res.status(500).json({error:'Unable to open operator portal'});}
}
