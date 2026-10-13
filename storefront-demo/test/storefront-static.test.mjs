import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Render proxies real API requests to the Supabase Edge backend',async()=>{
 const server=await read('render-server.mjs');
 assert.match(server,/functions\/v1\/early-storefront-backend/);
 assert.match(server,/\/health\/db/);
 assert.match(server,/\/api\/merchant\/products/);
 assert.match(server,/\/api\/operator\/stores/);
 assert.doesNotMatch(server,/EARLY_STOREFRONT_DATABASE_URL/);
});

test('Private management links never expire by default and can be revoked',async()=>{
 const server=await read('server/management-links.mjs');
 assert.match(server,/'infinity'::timestamptz/);
 assert.match(server,/revoked_at IS NULL/);
 assert.doesNotMatch(server,/interval '48 hours'/);
});

test('Merchant never needs a password, receives a reusable private-link capability',async()=>{
 const claim=await read('manage/claim.html');
 const manager=await read('manage/index.html');
 assert.match(claim,/location\.hash/);
 assert.match(claim,/sessionStorage\.setItem\('mysales_private_management_token'/);
 assert.match(manager,/sessionStorage\.getItem\('mysales_private_management_token'/);
 assert.match(manager,/Authorization.*Bearer/);
 assert.match(manager,/upload-image/);
 assert.match(manager,/update-product/);
 assert.match(manager,/archive-product/);
});

test('Operator has a secure link generator and can rotate merchants links',async()=>{
 const setup=await read('operator/setup.html');
 const ui=await read('operator/index.html');
 assert.match(setup,/crypto\.getRandomValues/);
 assert.match(setup,/crypto\.subtle\.digest/);
 assert.match(setup,/operator_links/);
 assert.match(ui,/action:'rotate'/);
 assert.match(ui,/action:'create'/);
});

test('Edge stores secrets only as hashes and checks them for every merchant action',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(edge,/crypto\.subtle\.digest/);
 assert.match(edge,/l\.token_hash=/);
 assert.match(edge,/revoked_at is null/);
 assert.match(edge,/SUPABASE_DB_URL/);
 assert.match(edge,/\/api\/merchant\/upload-image/);
 assert.match(edge,/early-storefront-products/);
});

test('Customer WhatsApp enquiry cannot deduct inventory',async()=>{
 const storefront=await read('s/index.html');
 assert.match(storefront,/wa\.me/);
 assert.doesNotMatch(storefront,/\/api\/merchant\/confirm-sale/);
});


test('Visitors can create stores directly from the public demo without an ERP login',async()=>{
 const landing=await read('index.html');
 const catalogue=await read('s/index.html');
 const create=await read('create/index.html');
 const proxy=await read('render-server.mjs');
 assert.match(landing,/href="\/create\/"/);
 assert.match(catalogue,/id="demo-banner"/);
 assert.match(catalogue,/href="\/create\/"/);
 assert.match(create,/fetch\('\/api\/signup'/);
 assert.match(create,/managementLink/);
 assert.match(proxy,/\/api\/signup/);
 assert.match(proxy,/early-storefront-signup/);
});

test('Public store registration issues scoped private tokens without operator privileges',async()=>{
 const signup=await read('supabase/functions/early-storefront-signup/index.ts');
 assert.match(signup,/tokenHash/);
 assert.match(signup,/management_links/);
 assert.match(signup,/status\)/);
 assert.match(signup,/draft/);
 assert.match(signup,/pg_advisory_xact_lock/);
 assert.doesNotMatch(signup,/operator_links/);
 assert.doesNotMatch(signup,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('First product flow is photo-first and does not expose unit conversion jargon',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/Choose a product photo/);
 assert.match(manager,/Product name/);
 assert.match(manager,/Selling price/);
 assert.match(manager,/Optional details & stock/);
 assert.match(manager,/post\('publish'/);
 assert.match(manager,/post\('store-settings'/);
 assert.doesNotMatch(manager,/Pieces per selling unit/);
});


test('signup uses its isolated backend and enforces request limits at both layers',async()=>{
 const server=await read('render-server.mjs');
 const signup=await read('supabase/functions/early-storefront-signup/index.ts');
 assert.ok(server.includes("const upstream=path==='/api/signup'"));
 assert.ok(server.includes('early-storefront-signup'));
 assert.ok(server.includes("path==='/api/signup'?6000:65536"));
 assert.ok(signup.includes('used>cap'));
 assert.ok(signup.includes('response(413'));
 assert.ok(signup.includes('pg_advisory_xact_lock'));
});

test('both public and management endpoints are scoped to merchant stores',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.ok(edge.includes('where p.store_id=${storeId}'));
 assert.ok(edge.includes('where store_id=${id}'));
 assert.ok(edge.includes('l.revoked_at is null'));
});


test('proxy streams responses and exposes safe upstream timing diagnostics',async()=>{
 const server=await read('render-server.mjs');
 assert.ok(server.includes('Readable.fromWeb(response.body)'));
 assert.ok(server.includes('upstreamDurationMs'));
 assert.ok(server.includes('Server-Timing'));
 assert.ok(server.includes("console.warn('Storefront upstream issue',path"));
 assert.doesNotMatch(server,/console\.warn\([^\n]*authorization/i);
});

test('merchant setup shows only the relevant step and protects required product images',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/showManagerView/);
 assert.match(manager,/id="product-section"/);
 assert.match(manager,/id="add-section"/);
 assert.match(manager,/id="cancel-add"/);
 assert.match(manager,/id="product-photo"[^>]*required/);
 assert.match(manager,/photoUploaded/);
 assert.match(manager,/imageUrl/);
});

test('focused landing and demo do not show competing marketing messages',async()=>{
 const home=await read('index.html');
 const signup=await read('create/index.html');
 const catalogue=await read('s/index.html');
 assert.match(home,/One link for/);
 assert.match(home,/href="\/create\/"/);
 assert.match(signup,/optional-details/);
 assert.doesNotMatch(home,/faq/);
 assert.doesNotMatch(catalogue,/id="floating"/);
 assert.doesNotMatch(catalogue,/id="demo-foot"/);
 assert.match(catalogue,/id="basket" hidden/);
 assert.match(catalogue,/exampleImage/);
});
