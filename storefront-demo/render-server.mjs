import http from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const root=resolve('storefront-demo');
const edgeBase='https://wsxszbdvvtowmrnxdsrp.supabase.co/functions/v1/early-storefront-backend';
// Exact public origins accepted for browser POST requests; never trust wildcard origins.
const allowedOrigins=new Set(['https://store.mysalesofficial.com','https://mysales-early-storefront-branch.onrender.com']);
const allowed=new Set([
 '/api/store','/api/discover','/api/signup',
 '/api/merchant/me','/api/merchant/claim','/api/merchant/products','/api/merchant/activity',
 '/api/merchant/restock','/api/merchant/publish','/api/merchant/confirm-sale',
 '/api/merchant/export','/api/merchant/update-product',
 '/api/merchant/archive-product','/api/merchant/store-settings','/api/merchant/upload-image','/api/merchant/share-image',
 '/api/operator/me','/api/operator/stores','/api/operator/analytics','/api/activity',
]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
async function edgeFetch(path,method='GET',headers={},body) {
 const target=path.startsWith('/api/signup')?edgeBase.replace('/early-storefront-backend','/early-storefront-signup'):edgeBase;
 const response=await fetch(target+path,{method,headers,body,signal:AbortSignal.timeout(12000),redirect:'error'});
 const raw=await response.text();
 return {response,raw};
}
http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/','http://localhost');
 const path=url.pathname;
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
 try{

  // Same-origin image proxy: strictly scoped to public photos in our own Storage bucket.
  // URLs and arbitrary remote hosts are NOT accepted (prevents SSRF).
  if(path==='/api/catalogue-photo'){
   if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
   const key=url.searchParams.get('key')||'';
   const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
   if(!new RegExp('^'+uuid+'/'+uuid+'/'+uuid+'\\.(?:jpg|jpeg|png|webp)$').test(key))
    return json(res,400,{error:'Invalid image key'});
   const upstream='https://wsxszbdvvtowmrnxdsrp.supabase.co/storage/v1/object/public/early-storefront-products/'+key;
   try{
    const picture=await fetch(upstream,{method:'GET',redirect:'error',signal:AbortSignal.timeout(11000)});
    if(!picture.ok||!picture.body)return json(res,404,{error:'Product image unavailable'});
    const type=(picture.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(type))
     return json(res,502,{error:'Invalid image response'});
    if(Number(picture.headers.get('content-length')||0)>5000000)
     return json(res,413,{error:'Image exceeds size limit'});
    let size=0;const chunks=[];
    for await(const part of Readable.fromWeb(picture.body)){
     size+=part.length;
     if(size>5000000)return json(res,413,{error:'Image exceeds size limit'});
     chunks.push(part);
    }
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.statusCode=200;
    return res.end(Buffer.concat(chunks));
   }catch(error){
    console.warn('Product photo temporarily unavailable',error?.message);
    return json(res,503,{error:'Unable to load photo right now'});
   }
  }

  if(path==='/health')return json(res,200,{ok:true,backend:'supabase-edge',databaseConfigured:true});
  if(path==='/health/db'||path==='/health/edge'){
   res.setHeader('Cache-Control','no-store');
   try{
    const {response,raw}=await edgeFetch('/health');
    const result=JSON.parse(raw);
    return json(res,response.ok&&result.databaseConnected===true?200:503,{
      ok:response.ok&&result.databaseConnected===true,
      databaseConnected:response.ok&&result.databaseConnected===true,
      schemaReady:result.schemaReady===true,
      backend:'supabase-edge',
      renderDirectDatabaseCredentialsRequired:false,
    });
   }catch(e){console.error('Supabase backend health probe failed',e?.message);return json(res,503,{ok:false,databaseConnected:false,backend:'supabase-edge'});}
  }
  if(allowed.has(path)){
   const publicRead=path==='/api/store'||path==='/api/discover';
   res.setHeader('Cache-Control',publicRead?'public, max-age=6, stale-while-revalidate=15':'no-store');
   if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   if(req.method!=='GET'){
    const origin=req.headers.origin;
    if(origin && !allowedOrigins.has(origin))return json(res,403,{error:'Invalid origin'});
   }
   const headers={};
   if(req.headers.authorization)headers['authorization']=req.headers.authorization;
   if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
   if(req.headers.origin)headers['origin']=req.headers.origin;
   let body;
   if(req.method==='POST'){
    const chunks=[];let total=0;
    for await(const chunk of req){
     total+=chunk.length;
     if(total>(path==='/api/merchant/upload-image'?2100000:path==='/api/signup'?6000:65536))return json(res,413,{error:'Request too large'});
     chunks.push(chunk);
    }
    body=Buffer.concat(chunks);
   }
   try{
    // Do not buffer full exports or catalogues inside the Render proxy.
    // Streaming preserves back-pressure and keeps memory roughly constant.
    const upstream=path==='/api/signup'?edgeBase.replace('/early-storefront-backend','/early-storefront-signup'):edgeBase;
    const upstreamStarted=performance.now();
    const response=await fetch(upstream+path+url.search,{
     method:req.method,headers,body,redirect:'error',
     signal:AbortSignal.timeout(path==='/api/merchant/export'?25000:12000)
    });
    const upstreamDurationMs=Math.round(performance.now()-upstreamStarted);
    // Keep credentials out of logs; log only slow or failed upstream responses.
    if(response.status>=500||upstreamDurationMs>1500)
     console.warn('Storefront upstream issue',path,'status='+response.status,'duration_ms='+upstreamDurationMs);
    res.setHeader('Server-Timing','supabase;dur='+upstreamDurationMs);
    res.statusCode=response.status;
    res.setHeader('Content-Type',response.headers.get('content-type')||'application/json; charset=utf-8');
    if(publicRead){
     res.setHeader('Cache-Control',response.headers.get('cache-control')||'public, max-age=6');
    }
    const disposition=response.headers.get('content-disposition');
    if(disposition)res.setHeader('Content-Disposition',disposition);
    if(!response.body)return res.end();
    await pipeline(Readable.fromWeb(response.body),res);
    return;
   }catch(error){
    console.error('Supabase backend proxy failed:',error?.message);
    // If a streaming client disconnects, headers may already have been sent.
    // Never try to write a second JSON response over a broken response.
    if(res.headersSent){res.destroy();return;}
    return json(res,503,{error:'Storefront temporarily unavailable'});
   }
  }
  // Browsers often request /favicon.ico automatically; missing it is not a server failure.
  if(path==='/favicon.ico'){
   res.statusCode=204;
   res.setHeader('Cache-Control','public, max-age=86400');
   return res.end();
  }
  let staticPath=path;
  if(path==='/')staticPath='/index.html';
  if(path==='/discover'||path==='/discover/')staticPath='/discover/index.html';
  if(path==='/create'||path==='/create/')staticPath='/create/index.html';
  if(path==='/manage'||path==='/manage/')staticPath='/manage/index.html';
  if(path==='/manage/claim')staticPath='/manage/claim.html';
  if(path==='/operator'||path==='/operator/')staticPath='/operator/index.html';
  if(path==='/operator/claim')staticPath='/operator/claim.html';
  if(path==='/operator/setup')staticPath='/operator/setup.html';
  if(path==='/s'||path==='/s/'||/^\/s\/[a-z0-9-]+\/?$/.test(path))staticPath='/s/index.html';
  // Clean customer storefronts: /business-name (without /s or ?slug).
  // Static application routes above always take precedence.
  if(staticPath===path && /^\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(path))
    staticPath='/s/index.html';
  const file=resolve(root,'.'+staticPath);
  if(!file.startsWith(root+sep))return json(res,403,{error:'Forbidden'});
  if(!Object.hasOwn(mime,extname(file)))return json(res,404,{error:'Not found'});
  let bytes;
  try{bytes=await readFile(file);}
  catch(error){
   if(error?.code==='ENOENT'||error?.code==='ENOTDIR')return json(res,404,{error:'Not found'});
   throw error;
  }
  res.setHeader('Content-Type',mime[extname(file)]);
  if(path.startsWith('/manage')||path.startsWith('/operator'))res.setHeader('Cache-Control','no-store');
  return res.end(bytes);
 }catch(error){
  console.error('Request failed',error?.message);
  if(!res.headersSent)return json(res,500,{error:'Server error'});
 }
}).listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>{
 console.log('Early Storefront is listening; backend is Supabase Edge');
 edgeFetch('/health').then(({response,raw})=>{
  const data=JSON.parse(raw);
  console.log(response.ok&&data.databaseConnected?'Early Storefront Supabase Edge database READY':'Early Storefront Supabase Edge database NOT READY',response.status);
 }).catch(e=>console.error('Early Storefront Supabase Edge startup check failed',e?.message));
});
