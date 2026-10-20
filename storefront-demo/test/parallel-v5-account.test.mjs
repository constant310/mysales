import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eligibleStatusProducts,renderStatusImage,MAX_STATUS_ITEMS} from '../status-batch.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('old private-link merchant dashboard and its backend are preserved',async()=>{
 const server=await read('render-server.mjs');
 const oldManager=await read('legacy/manage/index.html');
 assert.match(server,/if\(allowed\.has\(path\)\)/);
 assert.match(server,/staticPath='\/manage\/index.html'/);
 assert.match(server,/early-storefront-backend'/);
 assert.match(oldManager,/mysales_private_management_token/);
 assert.match(oldManager,/id="status-products"/);
 assert.match(oldManager,/id="status-batch-dialog"/);
});
test('production domain has separate account V5 login, merchant signup and dashboard paths',async()=>{
 const server=await read('render-server.mjs');
 const client=await read('auth/client.mjs');
 const login=await read('login/index.html');
 const manager=await read('account/manage/index.html');
 const create=await read('account/create/index.html');
 assert.match(server,/staticPath='\/login\/index.html'/);
 assert.match(server,/staticPath='\/account\/manage\/index.html'/);
 assert.match(server,/staticPath='\/account\/create\/index.html'/);
 assert.match(server,/route=path\.slice\('\/api\/v5'\.length\)/);
 assert.match(server,/if\(!v5Allowed\.has\(route\)\)/);
 assert.match(server,/early-storefront-backend-v5-test/);
 assert.match(server,/early-storefront-signup-v5-test/);
 assert.match(client,/return '\/account\/manage\/'/);
 assert.match(client,/return '\/account\/start\/'/);
 assert.match(client,/\/api\/v5\/merchant\/me/);
 assert.match(create,/\/api\/v5\/signup/);
 assert.match(manager,/\/api\/v5\/merchant\//);
 assert.match(login,/signInWithPassword/);
 assert.match(login,/beginGoogleSignIn/);
});
test('V5 account manager uses original photo and once-only shop link',async()=>{
 const manager=await read('account/manage/index.html');
 assert.match(manager,/id="status-section"/);
 assert.match(manager,/id="status-show-price"/);
 assert.match(manager,/renderStatusImage\(p,\{/);
 assert.match(manager,/MAX_STATUS_ITEMS/);
 assert.match(manager,/navigator\.share\(\{files:statusFiles\}\)/);
 assert.doesNotMatch(manager,/navigator\.share\(\{files:statusFiles,title:/);
 assert.match(manager,/statusShopUrl\(\)/);
 assert.equal(MAX_STATUS_ITEMS,12);
 assert.equal(eligibleStatusProducts([
  {id:'yes',published:true,image_path:'https://example.test/photo',units:[{price:18000}]},
  {id:'hidden',published:false,image_path:'https://example.test/photo',units:[{price:18000}]}
 ]).length,1);
});
test('account onboarding preserves legacy redirects and has no hardcoded financial credentials',async()=>{
 const manager=await read('account/manage/index.html');
 const client=await read('auth/client.mjs');
 const server=await read('render-server.mjs');
 assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
 assert.doesNotMatch(server,/['"]service_role['"]|sb_secret_/);
 assert.match(client,/provider=google/);
 assert.match(manager,/requireAccount/);
});
