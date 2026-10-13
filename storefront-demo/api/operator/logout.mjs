import {safeOrigin} from '../../server/http-auth.mjs';
import {logoutOperator} from '../../server/operator-access.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
 try{res.setHeader('Set-Cookie',await logoutOperator(req));return res.status(200).json({ok:true});}
 catch(e){console.error('Operator logout failed',e.message);return res.status(500).json({error:'Unable to close session'});}
}
