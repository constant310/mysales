const http=require('node:http');
const crypto=require('node:crypto');
const ORIGIN=process.env.STOREFRONT_ORIGIN||'https://mysales-storefront-template-01.onrender.com';
const PRICE={promotion_test:1000,subscription_test:2500};
const PORT=Number(process.env.PORT||10000);
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function paystack(path,body){const key=process.env.PAYSTACK_SECRET_KEY;if(!key||!key.startsWith('sk_test_'))throw Error('Test Paystack secret is not configured');const r=await fetch('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.status)throw Error(d.message||'Paystack request failed');return d.data}
http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});return res.end()}
 if(req.url==='/health'&&req.method==='GET')return reply(res,200,{ok:true,mode:'test',platformOnly:true});
 if(!req.url.startsWith('/api/payments/'))return reply(res,404,{error:'Not found'});
 if(req.headers.origin!==ORIGIN)return reply(res,403,{error:'Origin not allowed'});
 try{
  if(req.url==='/api/payments/initialize'&&req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Request too large')}
   const input=JSON.parse(raw);if(!PRICE[input.kind]||!/^\S+@\S+\.\S+$/.test(input.email||''))return reply(res,400,{error:'Valid email and platform payment type required'});
   const reference='MSDEMO-'+crypto.randomBytes(12).toString('hex');
   const data=await paystack('/transaction/initialize',{email:input.email,amount:PRICE[input.kind]*100,currency:'NGN',reference,callback_url:ORIGIN+'/?payment_ref='+encodeURIComponent(reference),metadata:{kind:input.kind,platform:'mysales-storefront-demo'}});
   return reply(res,200,{authorization_url:data.authorization_url,reference,amount:PRICE[input.kind],currency:'NGN'});
  }
  if(req.url==='/api/payments/verify'&&req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Request too large')}
   const {reference}=JSON.parse(raw);if(!/^MSDEMO-[a-f0-9]{24}$/.test(reference||''))return reply(res,400,{error:'Invalid reference'});
   const data=await paystack('/transaction/verify/'+encodeURIComponent(reference));
   const kind=data.metadata?.kind;const verified=data.status==='success'&&data.currency==='NGN'&&data.reference===reference&&PRICE[kind]&&data.amount===PRICE[kind]*100&&data.metadata?.platform==='mysales-storefront-demo';
   return reply(res,200,{verified:!!verified,status:data.status,reference,kind:verified?kind:null});
  }
  return reply(res,404,{error:'Not found'});
 }catch(e){return reply(res,502,{error:'Payment provider unavailable or request invalid'})}
}).listen(PORT,'0.0.0.0');