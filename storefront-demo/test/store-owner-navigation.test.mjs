import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canManagePublicStore,ownerMatchesPublicStore} from '../auth/owner-nav.mjs';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const shop={slug:'safe-minds',public_handle:'safe-minds'};
const account={authenticated:true,store:{slug:'safe-minds',public_handle:'safe-minds'}};

test('owner button is initially hidden, with a real dashboard link',async()=>{
 const html=await read('s/index.html');
 assert.match(html,/id="owner-manage-link"[^>]*href="\/manage\/"[^>]*hidden/);
 assert.match(html,/id="guest-create-link"/);
 assert.match(html,/import \{canManagePublicStore\} from '\/auth\/owner-nav.mjs'/);
 assert.match(html,/canManagePublicStore\(store\)/);
 assert.match(html,/\$\('owner-manage-link'\)\.hidden=false/);
 assert.match(html,/\$\('guest-create-link'\)\.hidden=true/);
});

test('only this authenticated store owner matches',()=>{
 assert.equal(ownerMatchesPublicStore(shop,account),true);
 assert.equal(ownerMatchesPublicStore(shop,{authenticated:false,store:account.store}),false);
 assert.equal(ownerMatchesPublicStore(shop,{authenticated:true,store:{slug:'different',public_handle:'safe-minds'}}),false);
 assert.equal(ownerMatchesPublicStore(shop,{authenticated:true,store:{slug:'safe-minds',public_handle:'another'}}),false);
 assert.equal(ownerMatchesPublicStore(shop,{}),false);
 assert.equal(ownerMatchesPublicStore({},account),false);
});

test('signed-out shoppers never request merchant data',async()=>{
 let requests=0;
 assert.equal(await canManagePublicStore(shop,async()=>'',async()=>{requests++;throw Error('Unexpected call');}),false);
 assert.equal(requests,0);
});

test('owned store only: verify protected API response and no caching',async()=>{
 let target,init;
 const request=async(url,options)=>{target=url;init=options;return {ok:true,json:async()=>account};};
 assert.equal(await canManagePublicStore(shop,async()=>'session-access-token',request),true);
 assert.equal(target,'/api/merchant/me');
 assert.equal(init.headers.Authorization,'Bearer session-access-token');
 assert.equal(init.cache,'no-store');
 assert.equal(init.method,'GET');
 assert.equal(await canManagePublicStore({...shop,slug:'another'},async()=>'token',request),false);
});

test('unauthorized, absent, suspended and network errors fail closed',async()=>{
 for(const status of [401,403,404,500])
  assert.equal(await canManagePublicStore(shop,async()=>'token',async()=>({ok:false,status})),false);
 assert.equal(await canManagePublicStore(shop,async()=>{throw Error('offline');}),false);
 assert.equal(await canManagePublicStore(shop,async()=>'token',async()=>{throw Error('offline');}),false);
});

test('owner API validates Supabase user ID and store ownership server-side',async()=>{
 const api=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(api,/accountAuth\.auth\.getUser/);
 assert.match(api,/early_storefront\.store_owners/);
 assert.match(api,/where owner\.user_id=\$\{user\.id\}/);
 assert.match(api,/pathname === '\/api\/merchant\/me'/);
});
