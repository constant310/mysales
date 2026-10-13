import {requireMerchantSession} from './merchant-session-store.mjs';
export async function merchantFromRequest(req){
 const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-early_storefront_session='));
 if(!cookie)return null;
 const token=cookie.split('=').slice(1).join('=');
 return requireMerchantSession(token);
}
export function safeOrigin(req){
 const origin=req.headers.origin;
 if(!origin)return false;
 try{return new URL(origin).host===req.headers.host&&new URL(origin).protocol==='https:';}catch{return false;}
}
