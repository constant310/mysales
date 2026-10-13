// Early Storefront database gateway: Supabase-managed credentials never leave Supabase.
// Public catalogue reads are anonymous; every merchant write is protected by an
// unguessable private management URL or an HttpOnly store-scoped browser session.
import postgres from "npm:postgres@3.4.5";

const ORIGIN = "https://mysales-early-storefront-branch.onrender.com";
const COOKIE = "__Host-early_storefront_session";
const DB = Deno.env.get("SUPABASE_DB_URL");
const sql = DB ? postgres(DB, {max: 4, prepare: false, connect_timeout: 8, idle_timeout: 30}) : null;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const common = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const json = (status, data, extra = {}) => new Response(JSON.stringify(data),{status,headers:{...common,...extra}});
const intIn = (value,min,max) => Number.isSafeInteger(Number(value)) && Number(value)>=min && Number(value)<=max;
const sha256 = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const random = () => {
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const cookieValue = (req) => {
 const part=(req.headers.get("cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="));
 if(!part)return null;
 try{return decodeURIComponent(part.slice(COOKIE.length+1));}catch{return null;}
};
const setCookie = (token) => COOKIE+"="+encodeURIComponent(token)+"; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax";
const clearCookie = () => COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
const validOrigin = req => req.headers.get("origin")===ORIGIN;
const body = async req => {
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("content-type")||""))throw Object.assign(new Error("JSON required"),{status:415});
 const size=Number(req.headers.get("content-length")||0);
 if(size>65536)throw Object.assign(new Error("Request too large"),{status:413});
 const text=await req.text();
 if(text.length>65536)throw Object.assign(new Error("Request too large"),{status:413});
 try{return JSON.parse(text||"{}");}catch{throw Object.assign(new Error("Invalid JSON"),{status:400});}
};
const merchant = async req => {
 const token=cookieValue(req);
 if(!tokenPattern.test(token||""))return null;
 const rows=await sql.unsafe(
  "select s.store_id from early_storefront.sessions s join early_storefront.stores st on st.id=s.store_id where s.token_hash=$1 and s.store_id is not null and s.revoked_at is null and s.expires_at>now() limit 1",
  [await sha256(token)]);
 return rows[0]?.store_id||null;
};
const products = async id => sql.unsafe(
 "select p.id,p.name,p.description,p.category,p.published,p.base_unit,p.image_path,coalesce(s.quantity_base,0) as stock,coalesce(json_agg(json_build_object('id',u.id,'name',u.name,'factor',u.factor,'price',u.price_ngn,'active',u.active)) filter (where u.id is not null),'[]'::json) as units from early_storefront.products p left join early_storefront.stock s on s.product_id=p.id and s.store_id=p.store_id left join early_storefront.units u on u.product_id=p.id and u.store_id=p.store_id where p.store_id=$1 group by p.id,s.quantity_base order by p.created_at desc",
 [id]
);
const publicList = async search => {
 const term="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
 return await sql.unsafe(
  "select s.slug,s.name,s.description,count(distinct p.id)::int as product_count,coalesce(json_agg(distinct p.category) filter(where p.category is not null and p.category<>''),'[]'::json) as categories from early_storefront.stores s join early_storefront.products p on p.store_id=s.id and p.published=true where s.status='published' and ($1='' or s.name ilike $2 or s.description ilike $2 or exists(select 1 from early_storefront.products x where x.store_id=s.id and x.published=true and (x.name ilike $2 or x.category ilike $2))) group by s.id order by s.name asc limit 100",
  [search,term]
 );
};

const OP_COOKIE = "__Host-early_storefront_operator";
const operatorToken = req => {
 const part=(req.headers.get("cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(OP_COOKIE+"="));
 return part?part.slice(OP_COOKIE.length+1):null;
};
const activeOperator = async req => {
 const token=operatorToken(req);
 if(!tokenPattern.test(token||""))return false;
 const rows=await sql.unsafe("select s.link_id from early_storefront.operator_sessions s join early_storefront.operator_links l on l.id=s.link_id where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now() and l.revoked_at is null limit 1",[await sha256(token)]);
 return !!rows.length;
};
const issueStoreLink = token => ORIGIN+"/manage/claim#token="+encodeURIComponent(token);

Deno.serve(async (req) => {
 const u=new URL(req.url);
 const index=u.pathname.indexOf("/early-storefront-gateway/");
 const path=index>=0?u.pathname.slice(index+"/early-storefront-gateway".length):"";
 const method=req.method;
 if(!sql)return json(503,{error:"Database gateway not configured"});
 if(!path.startsWith("/api/"))return json(404,{error:"Not found"});
 try {
  if(method==="GET" && path==="/api/discover"){
   const q=(u.searchParams.get("q")||"").trim().slice(0,80);
   return json(200,{stores:await publicList(q),source:"live","route":"supabase-edge"},{"cache-control":"public, max-age=30"});
  }
  if(method==="GET" && path==="/api/store"){
   const slug=u.searchParams.get("slug")||"";
   if(!/^[a-z0-9-]{2,80}$/.test(slug))return json(400,{error:"Invalid store"});
   const store=await sql.unsafe("select id,slug,name,description,whatsapp from early_storefront.stores where slug=$1 and status='published' limit 1",[slug]);
   if(!store.length)return json(404,{error:"Store not found"});
   const items=await sql.unsafe(
    "select p.id,p.name,p.description,p.category,p.image_path,p.base_unit,coalesce(st.quantity_base,0) as stock,coalesce(json_agg(json_build_object('name',u.name,'factor',u.factor,'price',u.price_ngn)) filter(where u.id is not null),'[]'::json) as units from early_storefront.products p left join early_storefront.units u on u.product_id=p.id and u.store_id=p.store_id and u.active=true left join early_storefront.stock st on st.product_id=p.id and st.store_id=p.store_id where p.store_id=$1 and p.published=true group by p.id,st.quantity_base order by p.created_at desc",
    [store[0].id]
   );
   const {id, ...publicStore}=store[0];
   return json(200,{store:publicStore,products:items},{"cache-control":"public, max-age=30"});
  }

  if(path==="/api/operator/claim" && method==="POST"){
   if(!validOrigin(req))return json(403,{error:"Invalid origin"});
   const data=await body(req);
   if(!tokenPattern.test(data.token||""))return json(401,{error:"Invalid operator link"});
   const cookieToken=random();
   const found=await sql.begin(async tx=>{
    const rows=await tx.unsafe("update early_storefront.operator_links set last_used_at=now() where token_hash=$1 and revoked_at is null returning id",[await sha256(data.token)]);
    if(!rows.length)return false;
    await tx.unsafe("insert into early_storefront.operator_sessions(link_id,token_hash,expires_at) values($1,$2,now()+interval '7 days')",[rows[0].id,await sha256(cookieToken)]);
    return true;
   });
   if(!found)return json(401,{error:"Invalid or revoked operator link"});
   return json(200,{ok:true},{"set-cookie":OP_COOKIE+"="+cookieToken+"; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax"});
  }
  if(path==="/api/operator/logout" && method==="POST"){
   if(!validOrigin(req))return json(403,{error:"Invalid origin"});
   const token=operatorToken(req);
   if(tokenPattern.test(token||""))await sql.unsafe("update early_storefront.operator_sessions set revoked_at=now() where token_hash=$1",[await sha256(token)]);
   return json(200,{ok:true},{"set-cookie":OP_COOKIE+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"});
  }
  if(path==="/api/operator/me" && method==="GET")
   return (await activeOperator(req))?json(200,{authenticated:true}):json(401,{authenticated:false});
  if(path==="/api/operator/stores"){
   if(!(await activeOperator(req)))return json(401,{error:"Private operator access required"});
   if(method==="GET"){
    const rows=await sql.unsafe("select s.id,s.slug,s.name,s.description,s.whatsapp,s.status,s.created_at,(select count(*)::int from early_storefront.products p where p.store_id=s.id and p.archived_at is null) as product_count from early_storefront.stores s order by s.created_at desc limit 250");
    return json(200,{stores:rows});
   }
   if(method!=="POST")return json(405,{error:"Method not allowed"});
   if(!validOrigin(req))return json(403,{error:"Invalid origin"});
   const data=await body(req);
   if(data.action==="create"){
    const {slug,name,whatsapp,description=""}=data;
    if(typeof slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80||
       typeof name!=="string"||!name.trim()||name.length>150||typeof description!=="string"||description.length>2000||
       typeof whatsapp!=="string"||! /^\+?[1-9]\d{7,14}$/.test(whatsapp))
      return json(400,{error:"Check the store name, slug and WhatsApp number"});
    const privateToken=random();
    try{
     const store=await sql.begin(async tx=>{
      const rows=await tx.unsafe("insert into early_storefront.stores(slug,name,whatsapp,description,status) values($1,$2,$3,$4,'published') returning id,slug,name",[slug,name.trim(),whatsapp,description]);
      await tx.unsafe("insert into early_storefront.management_links(store_id,token_hash,expires_at) values($1,$2,'infinity'::timestamptz)",[rows[0].id,await sha256(privateToken)]);
      return rows[0];
     });
     return json(201,{store,publicUrl:"/s/?slug="+encodeURIComponent(store.slug),managementLink:issueStoreLink(privateToken)});
    }catch(e){
     if(e?.code==="23505")return json(409,{error:"That storefront slug is already in use"});
     throw e;
    }
   }
   if(data.action==="rotate"){
    if(!uuid.test(data.storeId||""))return json(400,{error:"Invalid store"});
    const privateToken=random();
    const rotated=await sql.begin(async tx=>{
     const found=await tx.unsafe("select id from early_storefront.stores where id=$1 for update",[data.storeId]);
     if(!found.length)return false;
     await tx.unsafe("update early_storefront.management_links set revoked_at=now() where store_id=$1 and revoked_at is null",[data.storeId]);
     await tx.unsafe("update early_storefront.sessions set revoked_at=now() where store_id=$1 and revoked_at is null",[data.storeId]);
     await tx.unsafe("insert into early_storefront.management_links(store_id,token_hash,expires_at) values($1,$2,'infinity'::timestamptz)",[data.storeId,await sha256(privateToken)]);
     return true;
    });
    return rotated?json(200,{storeId:data.storeId,managementLink:issueStoreLink(privateToken)}):json(404,{error:"Store not found"});
   }
   if(data.action==="publish-store"){
    if(!uuid.test(data.storeId||"")||typeof data.published!=="boolean")return json(400,{error:"Invalid store request"});
    const rows=await sql.unsafe("update early_storefront.stores set status=$2 where id=$1 returning id,status",[data.storeId,data.published?"published":"draft"]);
    return rows.length?json(200,rows[0]):json(404,{error:"Store not found"});
   }
   return json(400,{error:"Unknown action"});
  }

  if(path==="/api/merchant/claim" && method==="POST"){
   if(!validOrigin(req))return json(403,{error:"Invalid origin"});
   const data=await body(req);
   if(!tokenPattern.test(data.token||""))return json(401,{error:"Invalid private link"});
   const digest=await sha256(data.token);
   const session=random();
   const sessionHash=await sha256(session);
   const storeId=await sql.begin(async tx=>{
    const links=await tx.unsafe("select store_id from early_storefront.management_links where token_hash=$1 and revoked_at is null and expires_at>now() for update",[digest]);
    if(!links.length)return null;
    await tx.unsafe("update early_storefront.management_links set used_at=coalesce(used_at,now()) where token_hash=$1",[digest]);
    await tx.unsafe("insert into early_storefront.sessions(store_id,token_hash,expires_at) values($1,$2,now()+interval '7 days')",[links[0].store_id,sessionHash]);
    return links[0].store_id;
   });
   if(!storeId)return json(401,{error:"Link invalid or revoked"});
   return json(200,{ok:true,storeId},{"set-cookie":setCookie(session)});
  }
  if(path==="/api/merchant/logout" && method==="POST"){
   if(!validOrigin(req))return json(403,{error:"Invalid origin"});
   const token=cookieValue(req);
   if(tokenPattern.test(token||""))await sql.unsafe("update early_storefront.sessions set revoked_at=now() where token_hash=$1 and revoked_at is null",[await sha256(token)]);
   return json(200,{ok:true},{"set-cookie":clearCookie()});
  }
  if(!path.startsWith("/api/merchant/"))return json(404,{error:"Not found"});
  const id=await merchant(req);
  if(!id)return json(401,{error:"Private access required",authenticated:false});
  if(method==="GET" && path==="/api/merchant/me")return json(200,{authenticated:true,storeId:id});
  if(method==="GET" && path==="/api/merchant/products")return json(200,{products:await products(id)});
  if(method==="GET" && path==="/api/merchant/export"){
   const tables=["stores","products","units","stock","sales","stock_movements"];
   const result={format:"mysales-early-storefront",version:1,exportedAt:new Date().toISOString(),storeId:id,tables:{}};
   await sql.begin(async tx=>{
    for(const t of tables){
     result.tables[t]=await tx.unsafe("select * from early_storefront."+t+(t==="stores"?" where id=$1":" where store_id=$1"),[id]);
    }
   });
   return json(200,result,{"content-disposition":'attachment; filename="mysales-storefront-export.json"'});
  }
  if(method!=="POST")return json(405,{error:"Method not allowed"});
  if(!validOrigin(req))return json(403,{error:"Invalid origin"});
  const data=await body(req);

  if(path==="/api/merchant/products"){
   const {name,description="",category="",baseUnit="piece",unitName="piece",factor=1,price}=data;
   if(typeof name!=="string"||!name.trim()||name.length>150||typeof description!=="string"||description.length>2000||typeof category!=="string"||category.length>80||typeof baseUnit!=="string"||!baseUnit.trim()||baseUnit.length>40||typeof unitName!=="string"||!unitName.trim()||unitName.length>40||!intIn(factor,1,1000000)||!intIn(price,0,1000000000000))return json(400,{error:"Invalid product"});
   const row=await sql.begin(async tx=>{
    const p=await tx.unsafe("insert into early_storefront.products(store_id,name,description,category,base_unit,published) values($1,$2,$3,$4,$5,false) returning id",[id,name.trim(),description,category,baseUnit]);
    await tx.unsafe("insert into early_storefront.units(store_id,product_id,name,factor,price_ngn) values($1,$2,$3,$4,$5)",[id,p[0].id,unitName,Number(factor),Number(price)]);
    await tx.unsafe("insert into early_storefront.stock(store_id,product_id,quantity_base) values($1,$2,0)",[id,p[0].id]);
    return p[0];
   });
   return json(201,{id:row.id});
  }
  if(path==="/api/merchant/restock"){
   if(!uuid.test(data.productId||"")||!intIn(data.amount,1,10000000))return json(400,{error:"Invalid stock"});
   const result=await sql.begin(async tx=>{
    const rows=await tx.unsafe("update early_storefront.stock set quantity_base=quantity_base+$3 where store_id=$1 and product_id=$2 returning quantity_base",[id,data.productId,Number(data.amount)]);
    if(!rows.length)return null;
    await tx.unsafe("insert into early_storefront.stock_movements(store_id,product_id,delta_base,reason) values($1,$2,$3,'restock')",[id,data.productId,Number(data.amount)]);
    return rows[0].quantity_base;
   });
   return result===null?json(404,{error:"Product not found"}):json(200,{stock:result});
  }
  if(path==="/api/merchant/publish"){
   if(!uuid.test(data.productId||"")||typeof data.published!=="boolean")return json(400,{error:"Invalid request"});
   const rows=await sql.unsafe("update early_storefront.products set published=$3 where store_id=$1 and id=$2 returning id,published",[id,data.productId,data.published]);
   return rows.length?json(200,rows[0]):json(404,{error:"Product not found"});
  }
  if(path==="/api/merchant/confirm-sale"){
   if(!uuid.test(data.productId||"")||!uuid.test(data.unitId||"")||!uuid.test(data.requestKey||"")||!intIn(data.quantity,1,100000))return json(400,{error:"Invalid sale request"});
   try{
    const rows=await sql.unsafe("select early_storefront.record_sale($1,$2,$3,$4,$5) as sale_id",[id,data.productId,data.unitId,Number(data.quantity),data.requestKey]);
    return json(200,{saleId:rows[0].sale_id});
   }catch(e){
    if(/Insufficient stock|Selling unit not found|Invalid sale request/.test(String(e?.message||"")))return json(409,{error:e.message});
    throw e;
   }
  }
  if(path==="/api/merchant/update-product"){
   if(!uuid.test(data.productId||""))return json(400,{error:"Invalid product"});
   const name=data.name,description=data.description??"",category=data.category??"";
   if(typeof name!=="string"||!name.trim()||name.length>150||typeof description!=="string"||description.length>2000||typeof category!=="string"||category.length>80)return json(400,{error:"Invalid product"});
   const imagePath=data.imagePath??null;
   if(imagePath!==null&&(typeof imagePath!=="string"||imagePath.length>2000||!/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(imagePath)))return json(400,{error:"Invalid image URL"});
   const rows=await sql.unsafe("update early_storefront.products set name=$3,description=$4,category=$5,image_path=$6 where store_id=$1 and id=$2 returning id,name,description,category,image_path",[id,data.productId,name.trim(),description,category,imagePath]);
   return rows.length?json(200,rows[0]):json(404,{error:"Product not found"});
  }
  if(path==="/api/merchant/update-price"){
   if(!uuid.test(data.productId||"")||!uuid.test(data.unitId||"")||!intIn(data.price,0,1000000000000))return json(400,{error:"Invalid price"});
   const rows=await sql.unsafe("update early_storefront.units set price_ngn=$4 where store_id=$1 and product_id=$2 and id=$3 returning id,price_ngn",[id,data.productId,data.unitId,Number(data.price)]);
   return rows.length?json(200,rows[0]):json(404,{error:"Selling unit not found"});
  }
  return json(404,{error:"Not found"});
 }catch(e){
  if(e?.status&&[400,413,415].includes(e.status))return json(e.status,{error:e.message});
  console.error("Early Storefront gateway",path,e instanceof Error?e.message:"Unknown error");
  return json(500,{error:"Store service temporarily unavailable"});
 }
});
