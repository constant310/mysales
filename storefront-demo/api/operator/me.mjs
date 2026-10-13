import {operatorFromRequest} from '../../server/operator-access.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{const operator=await operatorFromRequest(req);
  return res.status(operator?200:401).json({authenticated:!!operator});
 }catch(e){console.error('Operator session check failed',e.message);return res.status(500).json({error:'Session unavailable'});}
}
