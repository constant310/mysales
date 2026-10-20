import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validPrivateToken,parseLegacyProof,readLegacyProof,saveClaimIntent,clearClaimIntent,managerEntry} from '../auth/merchant-flow.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const proof='A'.repeat(43);
const storage=(entries={})=>{const map=new Map(Object.entries(entries));return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};

test('converted merchant: signed-in account wins over obsolete local private-link token',()=>{
 assert.equal(managerEntry({accountSignedIn:true,legacyToken:proof}),'account');
 assert.equal(managerEntry({accountSignedIn:true}),'account');
 assert.equal(managerEntry({accountSignedIn:true,hash:'#token='+proof}),'legacy','explicit old private link remains usable');
 const client=read('auth/client.mjs');
 return client.then(s=>{
  assert.match(s,/if\(result\.ok\)return '\/account\/manage\/'/);
  assert.match(s,/if\(result\.status===404\)return '\/account\/start\/'/);
 });
});

test('not-yet-converted merchant: saved token opens legacy manager and can opt into linking',async()=>{
 assert.equal(managerEntry({legacyToken:proof,accountSignedIn:false}),'legacy');
 assert.equal(managerEntry({accountSignedIn:false}),'account');
 const legacy=await read('legacy/manage/index.html');
 assert.match(legacy,/id="migrate-account"/);
 assert.match(legacy,/saveClaimIntent\(sessionStorage,token\)/);
 assert.match(legacy,/location\.assign\('\/login\/\?migration=1'\)/);
 assert.match(legacy,/Already switched to sign-in/);
});

test('new merchant: choose store creation explicitly; never create a second shop by default',async()=>{
 const start=await read('account/start/index.html');
 const create=await read('account/create/index.html');
 assert.match(start,/Do you already have a mySales store/);
 assert.match(start,/\/account\/create\/\?flow=claim/);
 assert.match(start,/\/account\/create\/\?flow=new/);
 assert.match(start,/if\(response\.ok\)return location\.replace\('\/account\/manage\/'\)/);
 assert.match(start,/if\(response\.status!==404\)throw Error/);
 assert.match(create,/if\(!\['new','claim'\]\.includes\(flow\)\)location\.replace\('\/account\/start\/'\)/);
 assert.match(create,/claimPanel\.hidden=flow!=='claim'/);
 assert.match(create,/\$\('create'\)\.hidden=flow!=='new'/);
 assert.match(create,/\/api\/v5\/merchant\/transfer/);
 const server=await read('render-server.mjs');
 assert.match(server,/staticPath='\/account\/start\/index.html'/);
});

test('capability links validate strictly, never using names, WhatsApp or untrusted domains',()=>{
 assert.equal(validPrivateToken(proof),true);
 assert.equal(validPrivateToken('short'),false);
 assert.equal(parseLegacyProof(proof),proof);
 assert.equal(parseLegacyProof('https://store.mysalesofficial.com/legacy/manage/claim#token='+proof),proof);
 assert.equal(parseLegacyProof('https://mysales-early-storefront-branch.onrender.com/manage/claim#token='+proof),proof);
 assert.equal(parseLegacyProof('http://store.mysalesofficial.com/manage/claim#token='+proof),'');
 assert.equal(parseLegacyProof('https://evil.example/manage/claim#token='+proof),'');
 assert.equal(parseLegacyProof('https://store.mysalesofficial.com/manage/claim?token='+proof),'');
 assert.equal(parseLegacyProof('Amara Cakes'),'');
});

test('claim intent survives login in session storage, and only clears after successful transfer',async()=>{
 const ss=storage(), local=storage({mysales_private_management_token:proof});
 assert.equal(readLegacyProof(ss,local),proof);
 assert.equal(saveClaimIntent(ss,proof),true);
 assert.equal(readLegacyProof(ss,storage()),proof);
 clearClaimIntent(ss);
 assert.equal(readLegacyProof(ss,storage()),'');
 assert.equal(saveClaimIntent(ss,'bad'),false);
 const create=await read('account/create/index.html');
 const prior=create.indexOf('if(!response.ok)throw Error',create.indexOf("$('transfer-form').onsubmit"));
 const clear=create.indexOf('clearClaimIntent(sessionStorage)',create.indexOf("$('transfer-form').onsubmit"));
 assert.ok(prior>=0&&clear>prior,'failed transfers never clear the recovery proof');
 assert.doesNotMatch(create,/\$\('old-link'\)\.value=legacy/,'do not reveal private token in a form field');
});

test('existing shop transfer is gated by signed-in identity and ownership, not phone matching',async()=>{
 const source=await read('supabase/functions/early-storefront-backend/index.ts');
 assert.match(source,/pathname==='\/api\/merchant\/transfer'/);
 assert.match(source,/const user=await accountUser\(request\)/);
 assert.match(source,/management_links/);
 assert.match(source,/store_owners/);
 assert.match(source,/revoked_at=now\(\)/);
 const router=await read('render-server.mjs');
 assert.match(router,/early-storefront-backend-v5-test/);
 assert.match(router,/if\(!v5Allowed\.has\(route\)\)return json\(res,404/);
});

test('invalid or previously converted links clearly direct merchants to sign in',async()=>{
 const legacy=await read('legacy/manage/index.html');
 assert.match(legacy,/already linked this store to an account, sign in instead/i);
 assert.match(legacy,/href="\/login\/">Already switched to sign-in/);
 const login=await read('login/index.html');
 assert.match(login,/id="migration-hint"/);
 assert.match(login,/Connect existing store/);
});
