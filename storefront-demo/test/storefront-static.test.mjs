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
 assert.match(claim,/storage\.setItem\(key,token\)/);
 assert.match(claim,/\[sessionStorage,localStorage\]/);
 assert.match(manager,/storage\.getItem\(managerTokenKey\)/);
 assert.match(manager,/localStorage/);
 assert.match(manager,/id="access-recovery"/);
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
 assert.match(catalogue,/id="home-demo"/);
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
 assert.match(catalogue,/id="drawer"/);
 assert.match(catalogue,/id="home-count"/);
 assert.match(catalogue,/exampleImage/);
});









test('merchant products open a read-only details modal with explicit edit controls',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="product-dialog"/);
 assert.match(manager,/aria-modal="true"/);
 assert.match(manager,/id="dialog-edit"/);
 assert.match(manager,/id="dialog-close"/);
 assert.match(manager,/function openProductDialog/);
 assert.match(manager,/function enterProductEdit/);
 assert.match(manager,/function renderProduct/);
 assert.match(manager,/open\.onclick=\(\)=>openProductDialog\(p\.id\)/);
 assert.match(manager,/dialogForm\.hidden=true/);
 assert.match(manager,/dialogEditing=false/);
 assert.doesNotMatch(manager,/const more=document\.createElement\('details'\);more\.append\(node\('summary','More product options'\)\)/);
});
test('modal Save remains disabled until valid details or a product photo change',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="dialog-save"[^>]*disabled/);
 assert.match(manager,/function hasDetailChanges/);
 assert.match(manager,/function updateDetailSave/);
 assert.match(manager,/dialogForm\.checkValidity\(\)/);
 assert.match(manager,/Boolean\(dialogPhotoFile\)/);
 assert.match(manager,/dialogSave\.disabled=!dialogEditing\|\|dialogBusy\|\|!hasDetailChanges\(\)\|\|!allowed/);
 assert.match(manager,/id="dialog-photo"/);
 assert.match(manager,/id="dialog-edit-stock"/);
 assert.match(manager,/id="dialog-edit-published"/);
 assert.match(manager,/discard unsaved product changes/i);
});
test('secure product update saves stock and visibility atomically with audited adjustments',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(edge,/const hasStock=b\.stock!==undefined/);
 assert.match(edge,/const hasPublished=b\.published!==undefined/);
 assert.match(edge,/goodInt\(b\.stock,0,10000000\)/);
 assert.match(edge,/typeof b\.published!=='boolean'/);
 assert.match(edge,/early_storefront\.stock[\s\S]*for update/);
 assert.match(edge,/early_storefront\.stock_movements/);
 assert.match(edge,/manual_adjustment/);
 assert.match(edge,/where id=\$\{b\.productId\} and store_id=\$\{id\}/);
 assert.match(edge,/await sql\.begin/);
});







test('merchant settings display as three individual responsive cards',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="settings-heading"/);
 assert.match(manager,/id="settings-panel" class="settings-card"/);
 assert.match(manager,/id="whatsapp-panel" class="settings-card"/);
 assert.match(manager,/id="access-panel" class="settings-card"/);
 assert.match(manager,/class="settings-form-grid"/);
 assert.match(manager,/for="business-name"/);
 assert.match(manager,/for="business-whatsapp"/);
 assert.match(manager,/for="business-description"/);
 assert.match(manager,/for="business-status"/);
 assert.match(manager,/@media\(max-width:700px\)\{\.settings-form-grid\{grid-template-columns:1fr/);
 assert.match(manager,/\.settings-field input,\.settings-field textarea,\.settings-field select\{display:block!important;width:100%!important/);
});

test('business and WhatsApp settings save only when edited',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="business-save" type="submit" disabled/);
 assert.match(manager,/id="whatsapp-save" type="submit" disabled/);
 assert.match(manager,/function updateBusinessSave\(\)/);
 assert.match(manager,/function updateWhatsAppSave\(\)/);
 assert.match(manager,/businessFields\.some\(key=>values\[key\]!==businessBaseline\[key\]\)/);
 assert.match(manager,/whatsappBaseline!==null&&value!==whatsappBaseline/);
 assert.match(manager,/businessBaseline=businessValues\(\)/);
 assert.match(manager,/whatsappBaseline=\$\('whatsapp-template'\)\.value/);
 assert.match(manager,/settingsForm\.checkValidity\(\)/);
});

test('private link is only cleared after successful verification, never before retry',async()=>{
 const claim=await read('manage/claim.html');
 const manager=await read('manage/index.html');
 assert.match(claim,/if\(!r\.ok\)throw Error/);
 assert.match(claim,/if\(persisted\)\{/);
 assert.match(claim,/history\.replaceState\(null,'',location\.pathname\)/);
 assert.match(claim,/location\.replace\('\/manage\/#token='/);
 assert.doesNotMatch(claim,/history\.replaceState\(null,'',location\.pathname\);\s*async function enter/);
 assert.match(manager,/if\(location\.hash\)history\.replaceState/);
 assert.match(manager,/await api\('me'\)/);
 assert.match(manager,/rememberManagerToken\(token\)/);
});
test('merchant can recover access by pasting their private link without sharing it publicly',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="access-recovery"/);
 assert.match(manager,/id="recover-link"/);
 assert.match(manager,/id="recover-form"/);
 assert.match(manager,/id="retry-access"/);
 assert.match(manager,/function showAccessRecovery/);
 assert.match(manager,/const parsePrivateLink=input=>/);
 assert.match(manager,/link\.origin!==location\.origin/);
 assert.match(manager,/const result=await fetch\('\/api\/merchant\/me'/);
 assert.match(manager,/Authorization:'Bearer '\+candidate/);
 assert.match(manager,/forgetManagerToken\(\)/);
 assert.match(manager,/sessionStorage,localStorage/);
 assert.doesNotMatch(manager,/localStorage\.setItem\([^)]*currentStore/);
});
test('signup remembers private access on the merchant device',async()=>{
 const signup=await read('create/index.html');
 assert.match(signup,/const getSavedToken=/);
 assert.match(signup,/const rememberToken=/);
 assert.match(signup,/\[sessionStorage,localStorage\]/);
 assert.match(signup,/rememberToken\(value\)/);
 assert.match(signup,/\/manage\/\?welcome=1#token=/);
});


test('storefront is a single grid-only shopping experience with no Explore or bottom tabs',async()=>{
 const catalogue=await read('s/index.html');
 assert.match(catalogue,/id="products"/);
 assert.match(catalogue,/id="grid-products"/);
 assert.match(catalogue,/function renderProducts/);
 assert.match(catalogue,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(catalogue,/@media\(min-width:680px\)\{\.grid-products\{grid-template-columns:repeat\(3/);
 assert.match(catalogue,/@media\(min-width:1024px\)\{\.grid-products\{grid-template-columns:repeat\(4/);
 assert.doesNotMatch(catalogue,/id="explore-view"/);
 assert.doesNotMatch(catalogue,/id="bottom-nav"/);
 assert.doesNotMatch(catalogue,/id="nav-home"/);
 assert.doesNotMatch(catalogue,/id="nav-explore"/);
 assert.doesNotMatch(catalogue,/function switchView/);
 assert.doesNotMatch(catalogue,/scroll-snap-type:y mandatory/);
});

test('product cards use full-width Add to cart buttons with proper SVG icons',async()=>{
 const catalogue=await read('s/index.html');
 assert.match(catalogue,/\.grid-add\{display:flex;gap:8px;align-items:center;justify-content:center;width:100%/);
 assert.match(catalogue,/add\.textContent='Add to cart'/);
 assert.match(catalogue,/add\.onclick=\(\)=>openSheet\(p,add\)/);
 assert.match(catalogue,/grid-media/);
 assert.match(catalogue,/grid-title/);
 assert.match(catalogue,/grid-price/);
 assert.match(catalogue,/id="home-cart"/);
 assert.match(catalogue,/const CART_SVG=/);
 assert.doesNotMatch(catalogue,/id="like"/i);
 assert.doesNotMatch(catalogue,/id="share"/i);
});

test('customer shopping keeps stock-aware quantity selection, one basket, and WhatsApp templates',async()=>{
 const catalogue=await read('s/index.html');
 assert.match(catalogue,/function openSheet/);
 assert.match(catalogue,/function closeSheet/);
 assert.match(catalogue,/function renderCart/);
 assert.match(catalogue,/function unitsInBasket/);
 assert.match(catalogue,/function remaining/);
 assert.match(catalogue,/stock>0&&wanted>stock/);
 assert.match(catalogue,/id="purchase-sheet"/);
 assert.match(catalogue,/id="sheet-add"/);
 assert.match(catalogue,/id="sheet-enquire"/);
 assert.match(catalogue,/id="home-count"/);
 assert.match(catalogue,/id="add-toast"/);
 assert.match(catalogue,/id="toast-basket"/);
 assert.match(catalogue,/id="customer-note"/);
 assert.match(catalogue,/whatsapp_template/);
 assert.match(catalogue,/https:\/\/wa\.me\//);
 assert.match(catalogue,/if\(isDemo\|\|!cart\.size\)return/);
});

test('single-page category modal works without a wide filter dropdown',async()=>{
 const catalogue=await read('s/index.html');
 assert.match(catalogue,/id="filter-home"/);
 assert.match(catalogue,/id="filter-dialog"/);
 assert.match(catalogue,/id="filter-options"/);
 assert.match(catalogue,/id="filter-apply"/);
 assert.match(catalogue,/id="filter-clear"/);
 assert.match(catalogue,/function openFilters/);
 assert.match(catalogue,/\$\('filter-dialog'\)\.showModal\(\)/);
 assert.match(catalogue,/function applyFilters/);
 assert.match(catalogue,/categoryFilter/);
 assert.doesNotMatch(catalogue,/id="filter-explore"/);
 assert.doesNotMatch(catalogue,/id="category-home"/);
});
test('merchant manager separates top action buttons from product cards and uses scalable SVG settings icons',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/#app>\.hero\{margin-bottom:32px\}/);
 assert.match(manager,/\.settings-icon svg\{width:21px;height:21px;display:block\}/);
 assert.match(manager,/\.settings-chevron svg\{width:20px;height:20px/);
 assert.match(manager,/product-chevron/);
 assert.match(manager,/view\.className='product-view'/);
});

test('customer share link is the business-name path, not a visible slug or query string',async()=>{
 const manager=await read('manage/index.html');
 const catalogue=await read('s/index.html');
 const signup=await read('supabase/functions/early-storefront-signup/index.ts');
 const directory=await read('discover/index.html');
 const operator=await read('operator/index.html');
 const landing=await read('index.html');
 assert.match(manager,/function publicUrl\(\)\{return location\.origin\+'\/'\+encodeURIComponent\(currentStore\.public_handle/);
 assert.match(signup,/publicUrl:'\/'\+encodeURIComponent\(result\.store\.public_handle\)/);
 assert.match(directory,/link\.href='\/'\+encodeURIComponent\(store\.public_handle/);
 assert.match(operator,/a\.href='\/'\+encodeURIComponent\(s\.public_handle/);
 assert.match(catalogue,/const lookupParam=legacyRoute\?'slug':'handle'/);
 assert.doesNotMatch(landing,/href="\/demo-warri-pantry"/);
 assert.doesNotMatch(manager,/\/s\/\?slug=/);
});

test('clean /business-name routes and old shared links both reach storefronts',async()=>{
 const server=await read('render-server.mjs');
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const catalogue=await read('s/index.html');
 assert.match(server,/Clean customer storefronts:/);
 assert.match(server,/staticPath='\/s\/index\.html'/);
 assert.match(server,/staticPath===path/);
 assert.match(server,/if\(path==='\/s'/);
 assert.match(catalogue,/const legacyRoute=routeParts\[0\]==='s'/);
 assert.match(catalogue,/const slug=legacyRoute\?/);
 assert.match(edge,/const handle=query\.get\('handle'\)/);
 assert.match(edge,/where slug=\$\{slug\} and status='published'/);
 assert.match(edge,/s\.public_handle=\$\{handle\}/);
 assert.match(edge,/early_storefront\.public_handle_aliases/);
 assert.match(edge,/s\.status='published'/);
});

test('business name handles are unique, alias old URLs, and keep internal slugs separate',async()=>{
 const handleMigration=await read('sql/20261013_public_store_handles.sql');
 const aliasMigration=await read('sql/20261013_public_store_rename_aliases.sql');
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(handleMigration,/CREATE UNIQUE INDEX IF NOT EXISTS early_storefront_public_handle_unique/);
 assert.match(handleMigration,/pg_advisory_xact_lock/);
 assert.match(handleMigration,/ALTER COLUMN public_handle SET NOT NULL/);
 assert.match(aliasMigration,/public_handle_aliases/);
 assert.match(aliasMigration,/BEFORE UPDATE OF name/);
 assert.match(aliasMigration,/ON CONFLICT\(handle\) DO NOTHING/);
 assert.match(edge,/returning slug,public_handle,name,description,whatsapp,status,whatsapp_template/);
 assert.match(edge,/store:\{slug:actor\.slug,public_handle:actor\.public_handle/);
});

test('operator only enters a business name and never needs a manual slug',async()=>{
 const operator=await read('operator/index.html');
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.doesNotMatch(operator,/name="slug"/);
 assert.doesNotMatch(operator,/s\.name\+' · '\+s\.slug/);
 assert.match(operator,/name="name"/);
 assert.match(edge,/const internalSlug=base\+'-'\+crypto\.randomUUID/);
 assert.match(edge,/values\(\$\{internalSlug\}/);
 assert.doesNotMatch(edge,/String\(b\.slug/);
});

test('marketing homepage puts merchant creation before examples and uses a conversion-first message',async()=>{
 const landing=await read('index.html');
 assert.match(landing,/Your business deserves its/);
 assert.match(landing,/own store link/);
 assert.match(landing,/id="how-it-works"/);
 assert.match(landing,/This could be your store/);
 assert.match(landing,/Create my free store/);
 assert.match(landing,/No login needed/);
 assert.match(landing,/WhatsApp enquiries/);
 assert.ok((landing.match(/href="\/create\/"/g)||[]).length>=4);
 assert.doesNotMatch(landing,/href="\/demo-warri-pantry"/);
 assert.doesNotMatch(landing,/View a sample store/);
 assert.doesNotMatch(landing,/See example/);
});

test('customer storefront uses only functional quiet icons; conversion buttons are text-first',async()=>{
 const catalogue=await read('s/index.html');
 assert.match(catalogue,/add\.textContent='Add to cart'/);
 assert.match(catalogue,/class="shop-cta" href="#products">Browse products<\/a>/);
 assert.match(catalogue,/id="home-cart"/);
 assert.match(catalogue,/id="filter-home"/);
 assert.match(catalogue,/id="business-whatsapp"/);
 assert.match(catalogue,/class="icon-control"/);
 assert.doesNotMatch(catalogue,/id="filter-home"[^>]*>☷/);
 assert.doesNotMatch(catalogue,/id="home-cart"[^>]*>🛒/);
 assert.doesNotMatch(catalogue,/Browse products <span aria-hidden/);
});

test('merchant manager uses understandable labels and minimal non-decorative settings controls',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="add-more" type="button">Add product<\/button>/);
 assert.match(manager,/view\.className='product-view'/);
 assert.match(manager,/view=node\('span','View'\)/);
 assert.match(manager,/settings-action-hint/);
 assert.match(manager,/\.settings-card\[open\] \.settings-action-hint::after\{content:"Close"/);
 assert.match(manager,/id="photo-icon"><svg/);
 assert.doesNotMatch(manager,/id="add-more" type="button">\+ Add/);
});
