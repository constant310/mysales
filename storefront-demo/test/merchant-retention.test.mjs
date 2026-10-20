import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('all changed storefront screens contain syntactically valid interactive scripts',async()=>{
 for(const file of ['legacy/manage/index.html','test/fixtures/legacy-shop.html','test/fixtures/legacy-create.html','operator/index.html']){
  const html=await read(file);
  const moduleScript=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(moduleScript,file+' must have a module');
  assert.doesNotThrow(()=>new vm.Script(moduleScript,{filename:file}),file+' must parse');
 }
});

test('merchant cannot write activity without valid private manager credentials',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const auth=edge.indexOf('const actor = await merchant(request);');
 const rejection=edge.indexOf('if (!actor) return out(401',auth);
 const activity=edge.indexOf("if(pathname==='/api/merchant/activity'",auth);
 assert.ok(auth>=0&&rejection>auth&&activity>rejection);
 assert.match(edge,/merchant_activity_events/);
 assert.match(edge,/on conflict\(store_id,event_day,event_type,session_id\) do nothing/);
 assert.match(edge,/!uuid\.test\(sessionId\)/);
 const schema=await read('sql/20261016_retention_stock_and_merchant_events.sql');
 assert.match(schema,/REVOKE ALL ON early_storefront\.merchant_activity_events FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(schema,/ip_address|token_hash|user_agent|customer_email/);
});

test('stock mode is explicit, safe for pre-existing untracked products and sold-out tracked products',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const customer=await read('test/fixtures/legacy-shop.html');
 const manager=await read('legacy/manage/index.html');
 assert.match(edge,/p\.track_stock/);
 assert.match(edge,/track_stock=case when/);
 assert.match(edge,/b\.trackStock===true/);
 assert.match(customer,/p\.track_stock===true\?Math\.max/);
 assert.match(customer,/p\.track_stock===true&&wanted>stock/);
 assert.match(customer,/id="sheet-ask"/);
 assert.match(manager,/id="stock-mode"/);
 assert.match(manager,/id="dialog-track-stock"/);
 assert.match(manager,/values\.trackStock==='true'/);
 const migration=await read('sql/20261016_retention_stock_and_merchant_events.sql');
 assert.match(migration,/ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false/);
 assert.match(migration,/s\.quantity_base>0/);
});

test('merchants can share product details directly and the app tracks return visits',async()=>{
 const manager=await read('legacy/manage/index.html');
 assert.match(manager,/quick-share/);
 assert.match(manager,/Share on WhatsApp/);
 assert.match(manager,/reportMerchantActivity\('product_share'\)/);
 assert.match(manager,/reportMerchantActivity\('shop_share'\)/);
 assert.match(manager,/reportMerchantActivity\('dashboard_open'\)/);
 const signup=await read('test/fixtures/legacy-create.html');
 assert.match(signup,/rememberToken\(issuedToken\)/);
 const admin=await read('operator/index.html');
 assert.match(admin,/metric-merchant-active/);
 assert.match(admin,/metric-merchant-returning/);
 assert.match(admin,/metric-merchant-shares/);
 for(const proxy of ['render-server.mjs','api/vercel-proxy.js'])
  assert.match(await read(proxy),/\/api\/merchant\/activity/);
});
