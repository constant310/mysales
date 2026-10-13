// Public pilot signup: no ERP account required. Keep operator privileges separate.
import postgres from 'npm:postgres@3.4.5';

const url=Deno.env.get('SUPABASE_DB_URL');
const sql=url?postgres(url,{max:3,prepare:false,connect_timeout:7,idle_timeout:15}):null;
const allowedOrigin='https://mysales-early-storefront-branch.onrender.com';
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','access-control-allow-origin':allowedOrigin}
});
const hex=(bytes:Uint8Array)=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const randomToken=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
 .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
Deno.serve(async request=>{
 const path=new URL(request.url).pathname.replace(/^\/early-storefront-signup/,'');
 if(path!=='/api/signup')return response(404,{error:'Not found'});
 if(request.method!=='POST')return response(405,{error:'Method not allowed'});
 if(!sql)return response(503,{error:'Store creation is temporarily unavailable'});
 const origin=request.headers.get('origin');
 if(origin&&origin!==allowedOrigin)return response(403,{error:'Invalid origin'});
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))
  return response(415,{error:'JSON required'});
 if(Number(request.headers.get('content-length')||0)>6000)return response(413,{error:'Request too large'});
 try{
  // Enforce the actual request-body size, including chunked requests with no Content-Length.
  const cap=6000;
  const reader=request.body?.getReader();
  if(!reader)return response(400,{error:'Invalid request'});
  const chunks:Uint8Array[]=[];let used=0;
  try{
   while(true){
    const part=await reader.read();
    if(part.done)break;
    used+=part.value.byteLength;
    if(used>cap){await reader.cancel();return response(413,{error:'Request too large'});}
    chunks.push(part.value);
   }
  }finally{reader.releaseLock();}
  const incoming=new Uint8Array(used);let cursor=0;
  for(const chunk of chunks){incoming.set(chunk,cursor);cursor+=chunk.byteLength;}
  let data:unknown;
  try{data=JSON.parse(new TextDecoder().decode(incoming));}
  catch{return response(400,{error:'Invalid JSON'});}

  if(!data||typeof data!=='object'||Array.isArray(data))return response(400,{error:'Invalid request'});
  const fields=data as Record<string,unknown>;
  if(fields.website)return response(400,{error:'Invalid request'});
  const name=typeof fields.name==='string'?fields.name.trim():'';
  const description=typeof fields.description==='string'?fields.description.trim():'';
  const raw=typeof fields.whatsapp==='string'?fields.whatsapp.trim():'';
  let number=raw.replace(/[\s()-]/g,'');
  if(/^0[789]\d{9}$/.test(number))number='+234'+number.slice(1);
  if(/^234[789]\d{9}$/.test(number))number='+'+number;
  if(!/^\+[1-9]\d{7,14}$/.test(number)||name.length<2||name.length>100||
      description.length>400||!/^[-\p{L}\p{N}\s'&().,]+$/u.test(name))
   return response(400,{error:'Enter your business name and a valid WhatsApp number with country code.'});
  const slugBase=name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'')||'shop';
  const suffix=hex(crypto.getRandomValues(new Uint8Array(4)));
  const slug=slugBase+'-'+suffix;
  const token=randomToken();
  const tokenHash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))));
  const result=await sql.begin(async tx=>{
   await tx.unsafe('select pg_advisory_xact_lock(71836211)');
   const existing=await tx.unsafe("select 1 from early_storefront.stores where regexp_replace(whatsapp,'[^0-9]','','g')=$1 and created_at>now()-interval '30 days' limit 1",[number.replace(/\D/g,'')]);
   if(existing.length)return {error:'phone'};
   const count=await tx.unsafe("select count(*)::int as total from early_storefront.stores where created_at>=now()-interval '1 hour'");
   if(Number(count[0].total)>=50)return {error:'limit'};
   const stores=await tx.unsafe("insert into early_storefront.stores(slug,name,description,whatsapp,status) values($1,$2,$3,$4,'draft') returning id,slug,public_handle,name",[slug,name,description,number]);
   await tx.unsafe("insert into early_storefront.management_links(store_id,token_hash,expires_at) values($1,$2,'infinity'::timestamptz)",[stores[0].id,tokenHash]);
   return {store:stores[0]};
  });
  if('error'in result){
   if(result.error==='phone')return response(409,{error:'A store was recently created using this WhatsApp number. Open your saved management link or contact mySales for help.'});
   return response(429,{error:'We are receiving too many requests. Please try again later.'});
  }
  return response(201,{store:result.store,
   managementLink:allowedOrigin+'/manage/claim#token='+encodeURIComponent(token),
   publicUrl:'/'+encodeURIComponent(result.store.public_handle)});
 }catch(e){
  console.error('Storefront signup failed',e instanceof Error?e.message:'Unknown error');
  return response(503,{error:'Could not create your store. Please try again.'});
 }
});