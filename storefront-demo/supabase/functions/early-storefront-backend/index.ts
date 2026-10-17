import postgres from 'npm:postgres@3.4.5';
import {createClient} from 'npm:@supabase/supabase-js@2';

const origin = 'https://store.mysalesofficial.com';
const trustedOrigins = new Set([origin,'https://mysales-early-storefront-branch.onrender.com','https://mysales-v5-email-staging.onrender.com']);
const originFor = (request:Request) => {
 const requested = request.headers.get('origin');
 return requested && trustedOrigins.has(requested) ? requested : origin;
};
const url = Deno.env.get('SUPABASE_DB_URL');
const sql = url ? postgres(url, { max: 2, prepare: false, connect_timeout: 7, idle_timeout: 10 }) : null;
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const out = (status: number, value: unknown, extra: Record<string,string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: {...headers,...extra} });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const link = /^[A-Za-z0-9_-]{43}$/;
const toHex = (bytes: Uint8Array) => [...bytes].map(x => x.toString(16).padStart(2,'0')).join('');
const hash = async (s: string) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const goodInt = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN);
  return Number.isSafeInteger(n) && n >= min && n <= max;
};
const textVal = (v: unknown, max: number, required = false) =>
  typeof v === 'string' && v.length <= max && (!required || !!v.trim());
const bodyJson = async (req: Request): Promise<Record<string,unknown>> => {
  if (!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) throw new Error('JSON required');
  const maxBytes=65536;
  const declared=Number(req.headers.get('content-length')||0);
  if(declared>maxBytes)throw new Error('Request too large');
  const reader=req.body?.getReader();
  if(!reader)throw new Error('Invalid JSON');
  const chunks:Uint8Array[]=[];
  let total=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){await reader.cancel();throw new Error('Request too large');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;
  for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
  let obj:unknown;
  try{obj=JSON.parse(new TextDecoder().decode(bytes));}
  catch{throw new Error('Invalid JSON');}
  if(!obj || typeof obj !== 'object' || Array.isArray(obj))throw new Error('Invalid JSON');
  return obj as Record<string,unknown>;
};
const accountAuth = createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_ANON_KEY')||'',{
 auth:{autoRefreshToken:false,persistSession:false}
});
async function accountUser(request:Request) {
 const match=/^Bearer ([A-Za-z0-9._-]{40,4096})$/.exec(request.headers.get('authorization')||'');
 if(!match)return null;
 const result=await accountAuth.auth.getUser(match[1]);
 return result.error||!result.data.user?.email_confirmed_at?null:result.data.user;
}
async function merchant(user:{id:string}) {
 const found=await sql!`select s.id as store_id,s.slug,s.public_handle,s.name,s.description,s.whatsapp,s.status,s.whatsapp_template
   from early_storefront.store_owners owner join early_storefront.stores s on s.id=owner.store_id
   where owner.user_id=${user.id} and s.status<>'suspended' limit 1`;
 return found[0]||null;
}
const productQuery = (storeId: string, publishedOnly: boolean) =>
  sql!`select p.id,p.name,p.description,p.category,p.image_path,p.base_unit,p.published,p.track_stock,
   coalesce(st.quantity_base,0) as stock,coalesce(u.units,'[]'::json) as units
   from early_storefront.products p
   left join early_storefront.stock st on st.product_id=p.id and st.store_id=p.store_id
   left join lateral (
     select json_agg(json_build_object('id',su.id,'name',su.name,'factor',su.factor,'price',su.price_ngn)
       order by su.created_at,su.id) as units
     from early_storefront.units su
     where su.product_id=p.id and su.store_id=p.store_id and su.active=true
   ) u on true
   where p.store_id=${storeId} and p.archived_at is null
     and (${!publishedOnly}::boolean or p.published=true)
   order by p.created_at desc,p.id desc`;
async function operator(request: Request) {
 const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')||'');
 if(!match)return false;
 const rows=await sql!`select id from early_storefront.operator_links where token_hash=${await hash(match[1])} and revoked_at is null limit 1`;
 return rows.length>0;
}
const managementUrl=(token:string,request:Request)=>originFor(request)+'/manage/claim#token='+encodeURIComponent(token);
const issuePrivateToken=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return btoa(String.fromCharCode(...bytes)).split('+').join('-').split('/').join('_').replaceAll('=','');
};
Deno.serve(async (request: Request) => {
  const pathname = new URL(request.url).pathname.replace(/^\/early-storefront-backend(?:-v5-test)?/,'');
  const query = new URL(request.url).searchParams;
  if (request.method === 'OPTIONS') return out(405,{ error:'Method not allowed' });
  if (!sql) return out(503,{ok:false,error:'Supabase internal database URL unavailable'});
  try {
    if (pathname === '/health' && request.method === 'GET') {
      await sql`select 1 from early_storefront.stores limit 0`;
      return out(200,{ok:true,databaseConnected:true,schemaReady:true,source:'supabase-internal'});
    }
    if (pathname === '/api/discover' && request.method === 'GET') {
      const q = (query.get('q')||'').trim().slice(0,80);
      const pattern = '%'+q.replace(/[\\%_]/g,'\\$&')+'%';
      const rows = await sql`select s.slug,s.public_handle,s.name,s.description,count(distinct p.id)::int as product_count,
        coalesce(json_agg(distinct p.category) filter(where p.category<>''),'[]'::json) as categories
        from early_storefront.stores s
        join early_storefront.products p on p.store_id=s.id and p.published=true and p.archived_at is null
        where s.status='published' and (${q}='' or s.name ilike ${pattern} or s.description ilike ${pattern}
          or exists (select 1 from early_storefront.products x where x.store_id=s.id and x.published=true and x.archived_at is null
            and (x.name ilike ${pattern} or x.category ilike ${pattern})))
        group by s.id order by s.name asc limit 100`;
      return out(200,{stores:rows,source:'live'},{'cache-control':'public, max-age=6, stale-while-revalidate=15'});
    }
    if (pathname === '/api/store' && request.method === 'GET') {
      // Customers use the stable business-name public handle; old ?slug= links work.
      const handle=query.get('handle')||'';
      const slug=query.get('slug')||'';
      const key=handle||slug;
      if(!/^[a-z0-9-]{2,80}$/.test(key))return out(400,{error:'Invalid store'});
      const stores=handle
        ? await sql`select s.id,s.slug,s.public_handle,s.name,s.description,s.whatsapp,s.whatsapp_template
          from early_storefront.stores s
          where s.status='published' and (
            s.public_handle=${handle} or exists (
              select 1 from early_storefront.public_handle_aliases a
              where a.store_id=s.id and a.handle=${handle}
            )
          ) limit 1`
        : await sql`select id,slug,public_handle,name,description,whatsapp,whatsapp_template
          from early_storefront.stores where slug=${slug} and status='published' limit 1`;
      if (!stores.length) return out(404,{error:'Store not found'});
      const {id,...store}=stores[0];
      const products=await productQuery(id,true);
      return out(200,{store,products},{'cache-control':'public, max-age=6, stale-while-revalidate=15'});
    }
    // Capture anonymous store activity. One browser-tab session per event per UTC day.
    if(pathname==='/api/activity' && request.method==='POST'){
      const requestedOrigin=request.headers.get('origin');
      if(!requestedOrigin || !trustedOrigins.has(requestedOrigin))return out(403,{error:'Invalid origin'});
      const b=await bodyJson(request);
      const handle=String(b.handle||''),eventType=String(b.eventType||''),sessionId=String(b.sessionId||'');
      if(!/^[a-z0-9-]{2,80}$/.test(handle) ||
         !['store_view','cart_add','whatsapp_click'].includes(eventType) ||
         !uuid.test(sessionId))return out(400,{error:'Invalid tracking event'});
      const found=await sql`select id from early_storefront.stores where public_handle=${handle} and status='published' limit 1`;
      if(!found.length)return out(404,{error:'Store not found'});
      await sql`insert into early_storefront.activity_events(store_id,event_type,session_id)
        values(${found[0].id},${eventType},${sessionId})
        on conflict(store_id,event_day,event_type,session_id) do nothing`;
      return out(202,{ok:true});
    }
    if(pathname.startsWith('/api/operator/')) {
      const requestedOrigin=request.headers.get('origin');
      if(request.method!=='GET' && requestedOrigin && !trustedOrigins.has(requestedOrigin)) return out(403,{error:'Invalid origin'});
      if(!(await operator(request)))return out(401,{error:'Private operator link required'});
      if(pathname==='/api/operator/me' && request.method==='GET')
        return out(200,{authenticated:true});
      if(pathname==='/api/operator/analytics' && request.method==='GET') {
        const days=query.get('days')==='7'?7:30;
        const since=days-1;
        const summary=await sql`select
          (select count(*)::int from early_storefront.stores) as total_stores,
          (select count(*)::int from early_storefront.stores where status='published') as published_stores,
          (select count(*)::int from early_storefront.stores where created_at >= now()-(${days}::int || ' days')::interval) as new_stores,
          (select count(distinct store_id)::int from early_storefront.products where archived_at is null) as stores_with_products,
          (select count(*)::int from early_storefront.products where archived_at is null) as total_products,
          (select count(*)::int from early_storefront.products where archived_at is null and published) as published_products,
          (select count(*)::int from early_storefront.sales) as recorded_sales,
          (select count(*)::int from early_storefront.sales where created_at >= now()-(${days}::int || ' days')::interval) as sales_period,
          (select count(*)::int from early_storefront.stores rs
             where rs.description not ilike '%TEST STORE%' and rs.name not ilike 'DEMO %' and rs.name not ilike 'mySales Demo %') as real_stores,
          (select count(*)::int from early_storefront.stores rs where rs.status='published'
             and rs.description not ilike '%TEST STORE%' and rs.name not ilike 'DEMO %' and rs.name not ilike 'mySales Demo %') as real_published_stores,
          (select count(*)::int from early_storefront.stores rs
             where rs.created_at >= now()-(${days}::int || ' days')::interval
             and rs.description not ilike '%TEST STORE%' and rs.name not ilike 'DEMO %' and rs.name not ilike 'mySales Demo %') as real_new_stores,
          (select count(distinct p.store_id)::int from early_storefront.products p
             join early_storefront.stores rs on rs.id=p.store_id
             where p.archived_at is null and rs.description not ilike '%TEST STORE%'
             and rs.name not ilike 'DEMO %' and rs.name not ilike 'mySales Demo %') as real_stores_with_products,
          (select count(*)::int from early_storefront.products p
             join early_storefront.stores rs on rs.id=p.store_id
             where p.archived_at is null and p.published=true and rs.description not ilike '%TEST STORE%'
             and rs.name not ilike 'DEMO %' and rs.name not ilike 'mySales Demo %') as real_published_products,
          (select count(*)::int from early_storefront.sales x
             join early_storefront.stores rs on rs.id=x.store_id
             where rs.description not ilike '%TEST STORE%' and rs.name not ilike 'DEMO %'
             and rs.name not ilike 'mySales Demo %') as real_sales,
          (select count(*)::int from early_storefront.sales x
             join early_storefront.stores rs on rs.id=x.store_id
             where x.created_at >= now()-(${days}::int || ' days')::interval
             and rs.description not ilike '%TEST STORE%' and rs.name not ilike 'DEMO %'
             and rs.name not ilike 'mySales Demo %') as real_sales_period,
          (select count(distinct a.store_id)::int from early_storefront.merchant_activity_events a
            join early_storefront.stores s on s.id=a.store_id
            where a.event_type='dashboard_open' and a.event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
            and s.description not ilike '%TEST STORE%' and s.name not ilike 'DEMO %' and s.name not ilike 'mySales Demo %') as active_merchants,
          (select count(*)::int from (
            select a.store_id from early_storefront.merchant_activity_events a
            join early_storefront.stores s on s.id=a.store_id
            where a.event_type='dashboard_open' and a.event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
            and s.description not ilike '%TEST STORE%' and s.name not ilike 'DEMO %' and s.name not ilike 'mySales Demo %'
            group by a.store_id having count(distinct a.event_day)>1
          ) returning_merchants) as returning_merchants,
          (select count(*)::int from early_storefront.merchant_activity_events a
            join early_storefront.stores s on s.id=a.store_id
            where a.event_type in ('product_share','shop_share')
            and a.event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
            and s.description not ilike '%TEST STORE%' and s.name not ilike 'DEMO %' and s.name not ilike 'mySales Demo %') as merchant_share_sessions`;
        const signups=await sql`select (created_at at time zone 'UTC')::date as day,count(*)::int as new_stores
          from early_storefront.stores where created_at >= now()-(${days}::int || ' days')::interval
          group by 1 order by 1`;
        const dailyEvents=await sql`select event_day as day,event_type,count(*)::int as sessions
          from early_storefront.activity_events where event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
          group by event_day,event_type order by event_day`;
        const stores=await sql`select s.id,s.name,s.public_handle,s.whatsapp,s.status,s.created_at,
          coalesce(p.product_count,0)::int as product_count,
          coalesce(p.published_count,0)::int as published_count,
          coalesce(ev.visits,0)::int as visits,
          coalesce(ev.cart_sessions,0)::int as cart_sessions,
          coalesce(ev.whatsapp_sessions,0)::int as whatsapp_sessions,
          coalesce(ma.active_days,0)::int as active_days,
          coalesce(ma.shares,0)::int as share_sessions,
          ma.last_active_at
          from early_storefront.stores s
          left join (select store_id,count(*)::int as product_count,
                     count(*) filter(where published)::int as published_count
                     from early_storefront.products where archived_at is null group by store_id) p on p.store_id=s.id
          left join (select store_id,
                      count(*) filter(where event_type='store_view')::int as visits,
                      count(*) filter(where event_type='cart_add')::int as cart_sessions,
                      count(*) filter(where event_type='whatsapp_click')::int as whatsapp_sessions
                     from early_storefront.activity_events where event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
                     group by store_id) ev on ev.store_id=s.id
          left join (select store_id,count(distinct event_day)::int as active_days,
                     count(*) filter(where event_type in ('shop_share','product_share'))::int as shares,
                     max(created_at) as last_active_at
                    from early_storefront.merchant_activity_events
                    where event_day >= ((now() at time zone 'UTC')::date - ${since}::int)
                    group by store_id) ma on ma.store_id=s.id
          order by s.created_at desc limit 250`;
        const totals=dailyEvents.reduce((a,r)=>{
          if(r.event_type==='store_view')a.visits+=r.sessions;
          if(r.event_type==='cart_add')a.cartSessions+=r.sessions;
          if(r.event_type==='whatsapp_click')a.whatsappSessions+=r.sessions;
          return a;
        },{visits:0,cartSessions:0,whatsappSessions:0});
        return out(200,{days,generatedAt:new Date().toISOString(),summary:summary[0],totals,
          signups,dailyEvents,stores,visitDefinition:'Browser-tab sessions per store per UTC day. Tracking starts after deployment.'});
      }
      if(pathname==='/api/operator/stores' && request.method==='GET') {
        const stores=await sql`select s.id,s.slug,s.public_handle,s.name,s.description,s.whatsapp,s.status,s.created_at,
          (select count(*)::int from early_storefront.products p where p.store_id=s.id and p.archived_at is null) as product_count
          from early_storefront.stores s order by s.created_at desc limit 250`;
        return out(200,{stores});
      }
      if(pathname==='/api/operator/stores' && request.method==='POST') {
        const b=await bodyJson(request);
        if(b.action==='create'){
          const phone=String(b.whatsapp||'');
          const digits=phone.replace(/[^0-9]/g,'');
          if(!textVal(b.name,150,true)||!textVal(b.description??'',2000)||
             !/^[+0-9]+$/.test(phone)||digits.length<8||digits.length>15||digits.startsWith('0'))
            return out(400,{error:'Invalid business name or WhatsApp number'});
          // Internal identifier is generated automatically; the customer only sees /business-name.
          const base=String(b.name).normalize('NFKD').toLowerCase()
            .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')
            .replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'')||'store';
          const internalSlug=base+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,8);
          const token=issuePrivateToken();
          const tokenHash=await hash(token);
          const store=await sql.begin(async tx=>{
            const rows=await tx`insert into early_storefront.stores(slug,name,description,whatsapp,status)
              values(${internalSlug},${String(b.name).trim()},${b.description??''},${b.whatsapp},'published')
              returning id,slug,public_handle,name`;
            await tx`insert into early_storefront.management_links(store_id,token_hash,expires_at)
              values(${rows[0].id},${tokenHash},'infinity'::timestamptz)`;
            return rows[0];
          });
          return out(201,{store,publicUrl:'/'+encodeURIComponent(store.public_handle),managementLink:managementUrl(token,request)});
        }
        if(b.action==='rotate'){
          if(!uuid.test(String(b.storeId||'')))return out(400,{error:'Invalid store'});
          const token=issuePrivateToken(),tokenHash=await hash(token);
          const rotated=await sql.begin(async tx=>{
            const found=await tx`select id from early_storefront.stores where id=${b.storeId} for update`;
            if(!found.length)return false;
            await tx`update early_storefront.management_links set revoked_at=now()
              where store_id=${b.storeId} and revoked_at is null`;
            await tx`update early_storefront.sessions set revoked_at=now() where store_id=${b.storeId} and revoked_at is null`;
            await tx`insert into early_storefront.management_links(store_id,token_hash,expires_at)
              values(${b.storeId},${tokenHash},'infinity'::timestamptz)`;
            return true;
          });
          return rotated?out(200,{storeId:b.storeId,managementLink:managementUrl(token,request)}):out(404,{error:'Store not found'});
        }
        if(b.action==='publish-store'){
          if(!uuid.test(String(b.storeId||''))||typeof b.published!=='boolean')
            return out(400,{error:'Invalid store request'});
          const rows=await sql`update early_storefront.stores set status=${b.published?'published':'draft'}
            where id=${b.storeId} and status<>'suspended' returning id,status`;
          return rows.length?out(200,rows[0]):out(404,{error:'Store not found'});
        }
        return out(400,{error:'Unknown action'});
      }
      return out(404,{error:'Unknown operator endpoint'});
    }
    if (!pathname.startsWith('/api/merchant/')) return out(404,{error:'Not found'});
    if (!['GET','POST','PATCH'].includes(request.method)) return out(405,{error:'Method not allowed'});
    if (request.method !== 'GET') {
      const requestedOrigin = request.headers.get('origin');
      if (requestedOrigin && !trustedOrigins.has(requestedOrigin)) return out(403,{error:'Invalid origin'});
    }
    // One-time migration for existing merchants. This is NOT used for routine
    // store management. A verified account can claim one unowned legacy store.
    if(pathname==='/api/merchant/transfer'&&request.method==='POST'){
      const user=await accountUser(request);
      if(!user)return out(401,{error:'Sign in first'});
      const data=await bodyJson(request);
      const legacyToken=String(data.legacyToken||'');
      if(!link.test(legacyToken))return out(400,{error:'Invalid old management link'});
      const digest=await hash(legacyToken);
      const result=await sql!.begin(async tx=>{
        const valid=await tx`select s.id from early_storefront.management_links l
          join early_storefront.stores s on s.id=l.store_id
          where l.token_hash=${digest} and l.revoked_at is null and l.expires_at>now()
          and s.status<>'suspended' for update of s`;
        if(!valid.length)return {status:404,error:'Old management link is invalid or already used'};
        const storeId=valid[0].id;
        const existing=await tx`select store_id from early_storefront.store_owners
          where store_id=${storeId} or user_id=${user.id} for update`;
        if(existing.length)return {status:409,error:'Store or account already has an owner'};
        await tx`insert into early_storefront.store_owners(store_id,user_id) values(${storeId},${user.id})`;
        await tx`update early_storefront.management_links set revoked_at=now()
          where store_id=${storeId} and revoked_at is null`;
        await tx`update early_storefront.sessions set revoked_at=now()
          where store_id=${storeId} and revoked_at is null`;
        return {status:200,storeId};
      });
      return result.error?out(result.status,{error:result.error}):out(200,{ok:true,storeId:result.storeId});
    }
    // Every merchant action requires a valid signed-in account and store ownership.
    const verified=await accountUser(request);
    if(!verified)return out(401,{error:'Please verify your email and sign in again'});
    const actor=await merchant(verified);
    if(!actor){
      const isOwner=await sql!`select store_id from early_storefront.store_owners where user_id=${verified.id} limit 1`;
      if(isOwner.length)return out(403,{error:'Your store is not available. Contact mySales support.'});
      if(pathname==='/api/merchant/me'&&request.method==='GET')
        return out(404,{authenticated:true,hasStore:false});
      return out(403,{error:'Create a store before using this feature'});
    }
    const id=actor.store_id as string;
    if (pathname === '/api/merchant/me' && request.method==='GET')
      return out(200,{authenticated:true,storeId:id,store:{slug:actor.slug,public_handle:actor.public_handle,name:actor.name,description:actor.description,whatsapp:actor.whatsapp,status:actor.status,whatsapp_template:actor.whatsapp_template}});
    if(pathname==='/api/merchant/activity' && request.method==='POST'){
      const b=await bodyJson(request);
      const eventType=String(b.eventType||''),sessionId=String(b.sessionId||'');
      if(!['dashboard_open','shop_share','product_share'].includes(eventType)||!uuid.test(sessionId))
        return out(400,{error:'Invalid activity event'});
      await sql`insert into early_storefront.merchant_activity_events(store_id,event_type,session_id)
        values(${id},${eventType},${sessionId})
        on conflict(store_id,event_day,event_type,session_id) do nothing`;
      return out(202,{ok:true});
    }
    if (pathname === '/api/merchant/claim' && request.method==='POST')
      return out(200,{ok:true,storeId:id,reusable:true});
    if (pathname === '/api/merchant/share-image' && request.method==='GET') {
      const productId=query.get('productId')||'';
      if(!uuid.test(productId))return out(400,{error:'Invalid product'});
      // Product URL comes from our store database, not from the request query.
      const found=await sql`select image_path from early_storefront.products
        where id=${productId} and store_id=${id} and archived_at is null limit 1`;
      if(!found.length||!found[0].image_path)return out(404,{error:'Product photo unavailable'});
      let photo:URL;
      try{photo=new URL(String(found[0].image_path));}catch{return out(422,{error:'Invalid image URL'});}
      const permitted=new Set(['wsxszbdvvtowmrnxdsrp.supabase.co','images.pexels.com','images.unsplash.com']);
      if(photo.protocol!=='https:'||photo.port||photo.username||photo.password||!permitted.has(photo.hostname))
        return out(422,{error:'Unsupported product image source'});
      try{
        const image=await fetch(photo.href,{headers:{accept:'image/jpeg,image/png,image/webp'},
          redirect:'error',signal:AbortSignal.timeout(9000)});
        if(!image.ok||!image.body)return out(502,{error:'Product photo could not be loaded'});
        const contentType=(image.headers.get('content-type')||'').split(';')[0].toLowerCase();
        if(!['image/jpeg','image/png','image/webp'].includes(contentType))
          return out(415,{error:'Unsupported product photo format'});
        const limit=5500000;
        if(Number(image.headers.get('content-length')||0)>limit)return out(413,{error:'Image too large'});
        const reader=image.body.getReader();const chunks:Uint8Array[]=[];let size=0;
        try{while(true){const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;if(size>limit){await reader.cancel();return out(413,{error:'Image too large'});}
          chunks.push(value);}}finally{reader.releaseLock();}
        if(size<20)return out(502,{error:'Empty product photo'});
        const bytes=new Uint8Array(size);let pos=0;
        for(const part of chunks){bytes.set(part,pos);pos+=part.byteLength;}
        return new Response(bytes,{status:200,headers:{
          'content-type':contentType,'cache-control':'private, no-store',
          'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
      }catch{return out(502,{error:'Could not retrieve product photo'});}
    }
    if (pathname === '/api/merchant/products' && request.method==='GET')
      return out(200,{products:await productQuery(id,false)});
    if (pathname === '/api/merchant/products' && request.method==='POST') {
      const b=await bodyJson(request);
      const name=b.name, description=b.description??'', category=b.category??'', baseUnit=b.baseUnit??'piece',
            unitName=b.unitName??'piece',factor=b.factor??1,price=b.price,trackStock=b.trackStock===true;
      if (!textVal(name,150,true)||!textVal(description,2000)||!textVal(category,80)||
        !textVal(baseUnit,40,true)||!textVal(unitName,40,true)||!goodInt(factor,1,1000000)||!goodInt(price,0,10000000000)||
        (b.trackStock!==undefined&&typeof b.trackStock!=='boolean'))
        return out(400,{error:'Invalid product'});
      const saved = await sql.begin(async tx => {
        const p=await tx`insert into early_storefront.products(store_id,name,description,category,base_unit,published,track_stock)
          values(${id},${String(name).trim()},${description},${category},${baseUnit},false,${trackStock}) returning id`;
        await tx`insert into early_storefront.units(store_id,product_id,name,factor,price_ngn)
          values(${id},${p[0].id},${unitName},${Number(factor)},${Number(price)})`;
        await tx`insert into early_storefront.stock(store_id,product_id,quantity_base) values(${id},${p[0].id},0)`;
        return p[0].id;
      });
      return out(201,{id:saved});
    }
    if (pathname === '/api/merchant/restock' && request.method==='POST') {
      const b=await bodyJson(request);
      if (!uuid.test(String(b.productId||''))||!goodInt(b.amount,1,10000000)) return out(400,{error:'Invalid stock'});
      const result = await sql.begin(async tx => {
        const updated=await tx`update early_storefront.stock st set quantity_base=quantity_base+${Number(b.amount)}
          from early_storefront.products p where st.store_id=${id} and st.product_id=${b.productId}
          and p.id=st.product_id and p.store_id=${id} and p.archived_at is null
          returning st.quantity_base`;
        if (!updated.length) throw new Error('Product not found');
        await tx`insert into early_storefront.stock_movements(store_id,product_id,delta_base,reason)
          values(${id},${b.productId},${Number(b.amount)},'restock')`;
        return updated[0].quantity_base;
      });
      return out(200,{stock:result});
    }
    if (pathname === '/api/merchant/publish' && request.method==='POST') {
      const b=await bodyJson(request);
      if (!uuid.test(String(b.productId||'')) || typeof b.published!=='boolean') return out(400,{error:'Invalid request'});
      const changed=await sql`update early_storefront.products set published=${b.published}
        where store_id=${id} and id=${b.productId} and archived_at is null returning id,published`;
      return changed.length?out(200,changed[0]):out(404,{error:'Product not found'});
    }
    if (pathname === '/api/merchant/confirm-sale' && request.method==='POST') {
      const b=await bodyJson(request);
      if (!uuid.test(String(b.productId||'')) || !uuid.test(String(b.unitId||'')) ||
        !uuid.test(String(b.requestKey||'')) || !goodInt(b.quantity,1,100000))
        return out(400,{error:'Invalid sale request'});
      const result=await sql`select early_storefront.record_sale(${id},${b.productId},${b.unitId},
        ${Number(b.quantity)},${b.requestKey}) as sale_id`;
      return out(200,{saleId:result[0].sale_id});
    }
    if (pathname === '/api/merchant/update-product' && request.method==='POST') {
      const b=await bodyJson(request);
      // Authenticated, store-scoped atomic edit with audited stock adjustments.
      const hasStock=b.stock!==undefined;
      const hasPublished=b.published!==undefined;
      const hasTracking=b.trackStock!==undefined;
      if (!uuid.test(String(b.productId||'')) || !textVal(b.name,150,true) ||
        !textVal(b.description??'',2000) || !textVal(b.category??'',80) ||
        !goodInt(b.price,0,10000000000) || !uuid.test(String(b.unitId||'')) ||
        (hasStock&&!goodInt(b.stock,0,10000000)) ||
        (hasPublished&&typeof b.published!=='boolean') ||
        (hasTracking&&typeof b.trackStock!=='boolean'))
        return out(400,{error:'Invalid product changes'});
      const changed=await sql.begin(async tx => {
        const prod=await tx`update early_storefront.products set name=${String(b.name).trim()},
          description=${b.description??''},category=${b.category??''},
          published=case when ${hasPublished} then ${hasPublished?b.published:false} else published end,
          track_stock=case when ${hasTracking} then ${hasTracking?b.trackStock:false} else track_stock end
          where id=${b.productId} and store_id=${id} and archived_at is null returning id`;
        if (!prod.length) return false;
        const unit=await tx`update early_storefront.units set price_ngn=${Number(b.price)}
          where id=${b.unitId} and product_id=${b.productId} and store_id=${id} returning id`;
        if (!unit.length) throw new Error('Selling unit not found');
        if(hasStock){
          const existing=await tx`select quantity_base from early_storefront.stock
            where store_id=${id} and product_id=${b.productId} for update`;
          if(!existing.length) throw new Error('Product inventory not found');
          const amount=Number(b.stock);
          const difference=amount-Number(existing[0].quantity_base);
          if(difference!==0){
            await tx`update early_storefront.stock set quantity_base=${amount}
              where store_id=${id} and product_id=${b.productId}`;
            await tx`insert into early_storefront.stock_movements(store_id,product_id,delta_base,reason)
              values(${id},${b.productId},${difference},'manual_adjustment')`;
          }
        }
        return true;
      });
      return changed?out(200,{ok:true}):out(404,{error:'Product not found'});
    }
    if (pathname === '/api/merchant/archive-product' && request.method==='POST') {
      const b=await bodyJson(request);
      if (!uuid.test(String(b.productId||''))) return out(400,{error:'Invalid product'});
      const changed=await sql`update early_storefront.products set archived_at=now(),published=false
        where store_id=${id} and id=${b.productId} and archived_at is null returning id`;
      return changed.length?out(200,{ok:true}):out(404,{error:'Product not found'});
    }
    if (pathname === '/api/merchant/store-settings' && request.method==='POST') {
      const b=await bodyJson(request);
      if (!textVal(b.name,150,true)||!textVal(b.description??'',2000)||!/^\+?[1-9]\d{7,14}$/.test(String(b.whatsapp||''))||
        !['draft','published'].includes(String(b.status))) return out(400,{error:'Invalid store settings'});
      // Older merchant clients omit the template when publishing their first item.
      // Preserve it on those updates instead of silently overwriting an edit.
      const template=b.whatsapp_template===undefined?actor.whatsapp_template:b.whatsapp_template;
      if(template!==null&&(!textVal(template,1500)||typeof template!=='string'))
        return out(400,{error:'WhatsApp message must be under 1,500 characters'});
      const changed=await sql`update early_storefront.stores set name=${String(b.name).trim()},
        description=${b.description??''},whatsapp=${b.whatsapp},status=${b.status},
        whatsapp_template=${template??null}
        where id=${id} and status<>'suspended' returning slug,public_handle,name,description,whatsapp,status,whatsapp_template`;
      return changed.length?out(200,{store:changed[0]}):out(404,{error:'Store not found'});
    }
    if (pathname === '/api/merchant/upload-image' && request.method==='POST') {
      if (!(request.headers.get('content-type')||'').startsWith('multipart/form-data'))
        return out(415,{error:'A product image is required'});
      const data=await request.formData();
      const productId=String(data.get('productId')||'');
      const file=data.get('image');
      if (!uuid.test(productId) || !(file instanceof File)) return out(400,{error:'Select a product and image'});
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2000000||file.size<20)
        return out(400,{error:'Use JPEG, PNG or WebP smaller than 2 MB'});
      const bytes=new Uint8Array(await file.arrayBuffer());
      const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
      const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if (!(file.type==='image/jpeg'&&jpg||file.type==='image/png'&&png||file.type==='image/webp'&&webp))
        return out(400,{error:'File content does not match an allowed image format'});
      const existing=await sql`select id from early_storefront.products where store_id=${id} and id=${productId} and archived_at is null`;
      if (!existing.length) return out(404,{error:'Product not found'});
      const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
      const secret=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const projectUrl=Deno.env.get('SUPABASE_URL');
      if (!secret||!projectUrl)return out(503,{error:'Image storage unavailable'});
      const client=createClient(projectUrl,secret,{auth:{autoRefreshToken:false,persistSession:false}});
      const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
      const filePath=id+'/'+productId+'/'+crypto.randomUUID()+'.'+ext;
      const uploaded=await client.storage.from('early-storefront-products').upload(filePath,bytes,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if (uploaded.error){console.error('Image upload failed',uploaded.error.message);return out(503,{error:'Image upload failed'});}
      const publicUrl=client.storage.from('early-storefront-products').getPublicUrl(filePath).data.publicUrl;
      await sql`update early_storefront.products set image_path=${publicUrl} where store_id=${id} and id=${productId}`;
      return out(200,{ok:true,imageUrl:publicUrl});
    }
    if (pathname === '/api/merchant/export' && request.method==='GET') {
      const data=await sql.begin(async tx => {
        await tx`set transaction isolation level repeatable read read only`;
        const stores=await tx`select * from early_storefront.stores where id=${id}`;
        const products=await tx`select * from early_storefront.products where store_id=${id}`;
        const units=await tx`select * from early_storefront.units where store_id=${id}`;
        const stock=await tx`select * from early_storefront.stock where store_id=${id}`;
        const sales=await tx`select * from early_storefront.sales where store_id=${id}`;
        const stock_movements=await tx`select * from early_storefront.stock_movements where store_id=${id}`;
        return {stores,products,units,stock,sales,stock_movements};
      });
      return out(200,{format:'mysales-early-storefront',version:1,exportedAt:new Date().toISOString(),storeId:id,tables:data},
       {'content-disposition':'attachment; filename="mysales-storefront-export.json"'});
    }
    return out(404,{error:'Not found'});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Insufficient stock|Selling unit not found|Invalid sale request|Product not found|Idempotency key reused for a different sale/.test(message))
      return out(409,{error:message});
    if(message==='Request too large')return out(413,{error:'Request body must be 64 KB or smaller'});
    if (/Invalid JSON|JSON required|Unexpected token|not valid JSON/.test(message))
      return out(400,{error:'Invalid JSON body'});
    console.error('Storefront Edge DB request failed:',message);
    return out(503,{error:'Storefront database unavailable'});
  }
});
