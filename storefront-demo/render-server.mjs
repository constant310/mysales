import {setDefaultCACertificates,getCACertificates} from 'node:tls';
// Node 24 does not always include the system CA store by default.
// Keep TLS verification enabled while adding system-trusted CAs.
setDefaultCACertificates([...getCACertificates('default'),...getCACertificates('system')]);
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
 '/api/merchant/login':'./api/merchant/login.mjs',
 '/api/merchant/logout':'./api/merchant/logout.mjs',
 '/api/merchant/claim':'./api/merchant/claim.mjs',
 '/api/merchant/products':'./api/merchant/products.mjs',
 '/api/merchant/export':'./api/merchant/export.mjs',
 '/api/merchant/restock':'./api/merchant/restock.mjs',
 '/api/merchant/publish':'./api/merchant/publish.mjs',
 '/api/merchant/confirm-sale':'./api/merchant/confirm-sale.mjs',
};
const configured=Boolean(process.env.EARLY_STOREFRONT_DATABASE_URL);
const healthPool=configured?new Pool({connectionString:process.env.EARLY_STOREFRONT_DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,max:1}):null;
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.status=(code)=>{res.statusCode=code;return res;};
 res.json=(value)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
 try{
  if(url.pathname==='/health')return res.status(200).json({ok:true,databaseConfigured:configured});
  if(url.pathname==='/health/db'){
   res.setHeader('Cache-Control','no-store');
   if(!healthPool)return res.status(503).json({ok:false,databaseConnected:false});
   try{await healthPool.query('select 1 from early_storefront.stores limit 0');return res.status(200).json({ok:true,databaseConnected:true,schemaReady:true});}
   catch(error){console.error('Database readiness failed',error?.code||error?.message);return res.status(503).json({ok:false,databaseConnected:false});}
  }
  if(routes[url.pathname]){
   if(!configured)return res.status(503).json({error:'Store database is not configured'});
   req.query=Object.fromEntries(url.searchParams);
   if(['POST','PUT','PATCH'].includes(req.method)){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>32768)return res.status(413).json({error:'Request too large'});chunks.push(chunk);}
    try{req.body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{return res.status(400).json({error:'Invalid JSON'});}
   }
   const module=await import(routes[url.pathname]);return await module.default(req,res);
  }
  let path=url.pathname;
  if(path==='/')path='/index.html';
  if(path==='/discover'||path==='/discover/')path='/discover/index.html';
  if(path==='/manage'||path==='/manage/')path='/manage/index.html';
  if(path==='/manage/claim')path='/manage/claim.html';
  if(path==='/s'||path==='/s/'||/^\/s\/[a-z0-9-]+\/?$/.test(path))path='/s/index.html';
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))return res.status(403).end('Forbidden');
  if(!['.html','.js','.css','.png','.webp','.ico','.svg'].includes(extname(file)))return res.status(404).end('Not found');
  const bytes=await readFile(file);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(path.startsWith('/manage'))res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  res.setHeader('X-Frame-Options','DENY');
  res.end(bytes);
 }catch(error){console.error('Request error',error?.message);if(!res.headersSent)res.status(500).end('Server error');}
}).listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Early Storefront server ready'));
