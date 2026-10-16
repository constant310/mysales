import {Readable} from 'node:stream';

const renderOrigin='https://mysales-early-storefront-branch.onrender.com';
const allowed=new Set([
 '/api/store','/api/discover','/api/signup',
 '/api/merchant/me','/api/merchant/claim','/api/merchant/products','/api/merchant/activity',
 '/api/merchant/restock','/api/merchant/publish','/api/merchant/confirm-sale',
 '/api/merchant/export','/api/merchant/update-product',
 '/api/merchant/archive-product','/api/merchant/store-settings','/api/merchant/upload-image','/api/merchant/share-image',
 '/api/operator/me','/api/operator/stores','/api/operator/analytics','/api/activity'
]);
function fail(res,status,message){return res.status(status).json({error:message});}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Cache-Control','no-store');
 const targetPath='/api/'+String(req.query.path||'').replace(/^\/+|\/+$/g,'');
 if(!allowed.has(targetPath))return fail(res,404,'Not found');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Method not allowed');
 if(req.method!=='GET'){
  const requestedOrigin=req.headers.origin;
  if(requestedOrigin){
   let isSameOrigin=false;
   try{const parsed=new URL(requestedOrigin);isSameOrigin=parsed.protocol==='https:'&&parsed.host===req.headers.host;}
   catch{}
   if(!isSameOrigin)return fail(res,403,'Invalid origin');
  }
 }
 const query=new URLSearchParams();
 for(const [k,v] of Object.entries(req.query)){
  if(k==='path')continue;
  for(const value of Array.isArray(v)?v:[v])if(value!==undefined)query.append(k,String(value));
 }
 let body;
 if(req.method==='POST'){
  const value=req.body;
  body=Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value):Buffer.from(JSON.stringify(value??{}));
  const max=targetPath==='/api/merchant/upload-image'?2100000:targetPath==='/api/signup'?6000:65536;
  if(body.byteLength>max)return fail(res,413,'Request too large');
 }
 const publicRead=targetPath==='/api/store'||targetPath==='/api/discover';
 const headers={};
 if(req.headers.authorization)headers.authorization=req.headers.authorization;
 if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
 if(targetPath==='/api/activity')headers.origin='https://store.mysalesofficial.com';
 // We validate the browser's Origin above, then omit it upstream. The
 // existing Render/Supabase service accepts only its own origin for writes.
 // Forwarding the Vercel Origin directly would make every write fail.
 try{
  const upstream=await fetch(renderOrigin+targetPath+(query.size?'?'+query.toString():''),{
   method:req.method,headers,body,redirect:'error',
   signal:AbortSignal.timeout(targetPath==='/api/merchant/export'?25000:20000)
  });
  res.status(upstream.status);
  res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/json; charset=utf-8');
  res.setHeader('Cache-Control',publicRead?'public, max-age=6, stale-while-revalidate=15':'no-store');
  const disposition=upstream.headers.get('content-disposition');
  if(disposition)res.setHeader('Content-Disposition',disposition);
  if(!upstream.body)return res.end();
  // The signup service still generates legacy Render links. Preserve its
  // database operation but keep all newly-created user links on this host.
  if(targetPath==='/api/signup'&&upstream.ok){
   const raw=await upstream.text();
   const siteOrigin='https://'+req.headers.host;
   res.end(raw.replaceAll(renderOrigin,siteOrigin));
   return;
  }
  Readable.fromWeb(upstream.body).pipe(res);
 }catch(error){
  console.error('Vercel storefront proxy failure:',targetPath,error?.message);
  if(!res.headersSent)return fail(res,503,'The store service is temporarily unavailable');
  res.end();
 }
}
