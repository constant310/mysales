import {setDefaultCACertificates,getCACertificates} from 'node:tls';
import {readFileSync} from 'node:fs';
// Node 24 does not always include the system CA store by default.
// Keep TLS verification enabled while adding system-trusted CAs.
const supabaseRootCA=readFileSync(new URL('./certs/supabase-root-2021.crt',import.meta.url),'utf8');
setDefaultCACertificates([...getCACertificates('default'),...getCACertificates('system'),supabaseRootCA]);
import http from 'node:http';
import pg from 'pg';
const {Pool} = pg;
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('storefront-demo');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const routes={
 '/api/store':'./api/store.mjs',
 '/api/discover':'./api/discover.mjs',
 '/api/merchant/me':'./api/merchant/me.mjs',
 '/api/merchant/logout':'./api/merchant/logout.mjs',
 '/api/merchant/claim':'./api/merchant/claim.mjs',
 '/api/merchant/products':'./api/merchant/products.mjs',
 '/api/merchant/export':'./api/merchant/export.mjs',
 '/api/merchant/restock':'./api/merchant/restock.mjs',
 '/api/merchant/publish':'./api/merchant/publish.mjs',
 '/api/merchant/confirm-sale':'./api/merchant/confirm-sale.mjs',
 '/api/operator/claim':'./api/operator/claim.mjs',
 '/api/operator/me':'./api/operator/me.mjs',
 '/api/operator/logout':'./api/operator/logout.mjs',
 '/api/operator/stores':'./api/operator/stores.mjs',
};
// All storefront data access is handled by Supabase Edge Functions. Database
// credentials remain inside Supabase and are not needed on Render.
const edgeBase='https://wsxszbdvvtowmrnxdsrp.supabase.co/functions/v1/early-storefront-gateway';
const edgeRoutes=new Set([...Object.keys(routes),'/api/merchant/update-product','/api/merchant/update-price']);
async function edgeReady(){
 const result=await fetch(edgeBase+'/api/discover',{signal:AbortSignal.timeout(12000)});
 if(!result.ok)return false;
 const data=await result.json();
 return data?.source==='live'&&Array.isArray(data.stores);
}
async function proxyToEdge(req,res,url){
 if(!edgeRoutes.has(url.pathname))return res.status(404).json({error:'Not found'});
 const method=req.method||'GET';
 if(!['GET','POST'].includes(method))return res.status(405).json({error:'Method not allowed'});
 const headers={};
 if(req.headers.origin)headers.origin=req.headers.origin;
 if(req.headers.cookie)headers.cookie=req.headers.cookie;
 if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
 let body;
 if(method==='POST'){
  const chunks=[];let size=0;
  for await(const chunk of req){
   size+=chunk.length;
   if(size>65536)return res.status(413).json({error:'Request too large'});
   chunks.push(chunk);
  }
  body=Buffer.concat(chunks);
 }
 let upstream;
 try{
  upstream=await fetch(edgeBase+url.pathname+url.search,{
   method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)
  });
 }catch(err){
  console.error('Storefront gateway unavailable',err?.code||err?.message);
  return res.status(503).json({error:'Store service temporarily unavailable'});
 }
 res.statusCode=upstream.status;
 for(const name of ['content-type','cache-control','content-disposition','set-cookie','referrer-policy']){
  const value=upstream.headers.get(name);
  if(value)res.setHeader(name,value);
 }
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Storefront-Database','supabase-edge');
 res.end(Buffer.from(await upstream.arrayBuffer()));
}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.status=(code)=>{res.statusCode=code;return res;};
 res.json=(value)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 try{
  if(url.pathname==='/health')
   return res.status(200).json({ok:true,backend:'supabase-edge'});
  if(url.pathname==='/health/db'||url.pathname==='/health/edge'){
   res.setHeader('Cache-Control','no-store');
   try{
    const ok=await edgeReady();
    return res.status(ok?200:503).json({
     ok,databaseConnected:ok,schemaReady:ok,
     via:'supabase-edge',renderDirectPostgresConnection:false
    });
   }catch(err){
    console.error('Edge gateway health check failed',err?.message);
    return res.status(503).json({ok:false,databaseConnected:false,schemaReady:false,via:'supabase-edge'});
   }
  }
  if(url.pathname.startsWith('/api/'))return proxyToEdge(req,res,url);
  let path=url.pathname;
  if(path==='/')path='/index.html';
  if(path==='/discover'||path==='/discover/')path='/discover/index.html';
  if(path==='/manage'||path==='/manage/')path='/manage/index.html';
  if(path==='/manage/claim')path='/manage/claim.html';
  if(path==='/operator'||path==='/operator/')path='/operator/index.html';
  if(path==='/operator/claim')path='/operator/claim.html';
  if(path==='/s'||path==='/s/'||/^\/s\/[a-z0-9-]+\/?$/.test(path))path='/s/index.html';
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))return res.status(403).end('Forbidden');
  if(!['.html','.js','.css','.png','.webp','.ico','.svg'].includes(extname(file)))return res.status(404).end('Not found');
  const bytes=await readFile(file);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(path.startsWith('/manage')||path.startsWith('/operator'))res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  res.setHeader('X-Frame-Options','DENY');
  res.end(bytes);
 }catch(error){console.error('Request error',error?.message);if(!res.headersSent)res.status(500).end('Server error');}
}).listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>{
 console.log('Early Storefront server ready (Supabase Edge backend)');
 edgeReady().then(ok=>console.log('Early Storefront Edge gateway readiness',ok?'CONNECTED':'FAILED'))
  .catch(err=>console.error('Early Storefront Edge gateway readiness error',err?.message));
});
