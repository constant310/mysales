import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('operator analytics requires revocable private link before stats can be returned',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const operatorIndex=edge.indexOf("if(pathname.startsWith('/api/operator/'))");
 const auth=edge.indexOf("if(!(await operator(request)))");
 const analytics=edge.indexOf("if(pathname==='/api/operator/analytics'");
 assert.ok(operatorIndex>=0&&auth>operatorIndex&&analytics>auth);
 assert.match(edge,/operator_links where token_hash=/);
 assert.match(edge,/revoked_at is null/);
 assert.match(edge,/total_stores/);
 assert.match(edge,/recorded_sales/);
 assert.match(edge,/stores_with_products/);
});
test('analytics events collect only a store, an anonymous browser-tab session, and a whitelisted event',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const migration=await read('sql/20261013_operator_dashboard_activity.sql');
 const page=await read('s/index.html');
 assert.match(edge,/pathname==='\/api\/activity'/);
 assert.match(edge,/trustedOrigins\.has\(requestedOrigin\)/);
 assert.match(edge,/uuid\.test\(sessionId\)/);
 assert.match(edge,/on conflict\(store_id,event_day,event_type,session_id\) do nothing/);
 assert.match(migration,/PRIMARY KEY\(store_id,event_day,event_type,session_id\)/);
 assert.match(migration,/REVOKE ALL ON early_storefront\.activity_events FROM PUBLIC, anon, authenticated/);
 for(const event of ['store_view','cart_add','whatsapp_click'])assert.match(page,new RegExp("trackActivity\\('"+event+"'\\)"));
 assert.doesNotMatch(migration,/ip_address|user_agent|phone_number|customer_email/i);
});
test('private dashboard preserves merchant management and never renders a fake visitor total',async()=>{
 const admin=await read('operator/index.html');
 const render=await read('render-server.mjs');
 const gateway=await read('api/vercel-proxy.js');
 assert.match(admin,/operatorToken=sessionStorage\.getItem/);
 assert.match(admin,/await api\('me'\)/);
 assert.match(admin,/api\('analytics\?days='/);
 assert.match(admin,/action:'create'/);
 assert.match(admin,/action:'rotate'/);
 assert.match(admin,/id="metric-visits">—/);
 assert.match(admin,/id="store-search"/);
 for(const proxy of [render,gateway]){
  assert.match(proxy,/\/api\/activity/);
  assert.match(proxy,/\/api\/operator\/analytics/);
 }
});
