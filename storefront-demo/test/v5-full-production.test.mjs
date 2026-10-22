import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eligibleStatusProducts,renderStatusImage,MAX_STATUS_ITEMS,statusSharePayload} from '../status-batch.mjs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('V5 landing page is the default and has an obvious Manage Store path',async()=>{
 const home=await read('index.html');
 const route=await read('render-server.mjs');
 assert.match(home,/class="manager-shortcut" href="\/account\/manage\/">Manage Store/);
 assert.match(home,/href="\/login\/">Create free store/);
 assert.match(home,/Secure owner login/);
 assert.match(route,/if\(path==='\/'\)staticPath='\/index.html'/);
 assert.match(route,/if\(path==='\/create'\|\|path==='\/create\/'\)staticPath='\/account\/create\/index\.html'/);
 assert.match(route,/if\(path==='\/account\/manage'/);
});

test('owners can open the manager from their live V5 shop, shoppers cannot',async()=>{
 const shop=await read('s/index.html');
 const ownerNav=await read('auth/owner-nav.mjs');
 assert.match(shop,/id="owner-manage-link"[^>]*href="\/account\/manage\/"[^>]*hidden/);
 assert.match(shop,/canManagePublicStore\(store\)/);
 assert.match(shop,/id="guest-create-link"/);
 assert.match(shop,/\/login\//);
 assert.match(ownerNav,/\/api\/v5\/merchant\/me/);
});

test('legacy links still reach old manager while all new accounts have a V5 dashboard',async()=>{
 const router=await read('render-server.mjs');
 const redirect=await read('manage/index.html');
 const legacy=await read('legacy/manage/index.html');
 const claim=await read('legacy/manage/claim.html');
 assert.match(router,/staticPath='\/legacy\/manage\/index.html'/);
 assert.match(router,/staticPath='\/legacy\/manage\/claim.html'/);
 assert.match(redirect,/location\.hash/);
 assert.match(redirect,/readLegacyProof/);
 assert.match(redirect,/\/legacy\/manage\//);
 assert.match(redirect,/\/account\/manage\//);
 assert.match(legacy,/id="products"/);
 assert.match(legacy,/\/legacy\/manage\/claim#token=/);
 assert.match(claim,/\/legacy\/manage\//);
});

test('V5 merchant uses server-side authenticated account API and preserves store claim',async()=>{
 const router=await read('render-server.mjs');
 const manager=await read('account/manage/index.html');
 const create=await read('account/create/index.html');
 const auth=await read('auth/client.mjs');
 for(const path of ['/api/merchant/me','/api/merchant/products','/api/merchant/transfer','/api/merchant/share-image'])
  assert.ok(router.includes("'"+path+"'"),path);
 assert.match(router,/early-storefront-backend-v5-test/);
 assert.match(router,/early-storefront-signup-v5-test/);
 assert.match(router,/if\(!v5Allowed\.has\(route\)\)return json\(res,404/);
 assert.match(router,/if\(origin&&!allowedOrigins\.has\(origin\)\)return json\(res,403/);
 assert.match(manager,/requireAccount\(/);
 assert.match(manager,/\/api\/v5\/merchant\//);
 assert.match(create,/\/api\/v5\/merchant\/transfer/);
 assert.match(create,/readLegacyProof/);
 assert.match(auth,/authRequest\('token\?grant_type=password'/);
 assert.match(auth,/provider=google/);
 assert.doesNotMatch(auth,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('V5 merchant Status batches use same mySales green template and exactly one printed shop link',async()=>{
 const manager=await read('account/manage/index.html');
 assert.match(manager,/id="status-section"/);
 assert.match(manager,/id="status-show-price"/);
 assert.match(manager,/renderStatusImage\(p,\{/);
 assert.match(manager,/MAX_STATUS_ITEMS/);
 assert.match(manager,/statusShopUrl\(\)/);
 assert.match(manager,/navigator\.share\(\{files:statusFiles\}\)/);
 assert.doesNotMatch(manager,/navigator\.share\(\{files:statusFiles[^}]*text:/);
 assert.equal(MAX_STATUS_ITEMS,12);
 const candidates=[
  {id:'1',name:'Fireball',published:true,image_path:'https://example.test/x.png',units:[{price:18000}]},
  {id:'2',name:'Secret',published:false,image_path:'https://example.test/y.png',units:[{price:1000}]}
 ];
 assert.equal(eligibleStatusProducts(candidates).length,1);
 assert.deepEqual(Object.keys(statusSharePayload([{name:'status.jpg'}])),['files']);
});

test('original product is never cropped in Status; the price is optional',async()=>{
 const calls={texts:[],draws:[],disposed:0};
 const ctx={beginPath(){},moveTo(){},arcTo(){},quadraticCurveTo(){},bezierCurveTo(){},lineTo(){},closePath(){},fill(){},fillRect(){},stroke(){},save(){},restore(){},translate(){},rotate(){},arc(){},
 fillText(s){calls.texts.push(String(s))},drawImage(...args){calls.draws.push(args)},
 measureText(s){return {width:String(s).length*10}},createLinearGradient(){return {addColorStop(){}}}};
 const documentBefore=globalThis.document;
 globalThis.document={createElement(tag){assert.equal(tag,'canvas');return{
  width:0,height:0,getContext(){return ctx},
  toBlob(cb){cb(new Blob(['picture'],{type:'image/jpeg'}))}
 }}};
 const image={naturalWidth:720,naturalHeight:1280},shopUrl='https://store.mysalesofficial.com/safe-minds';
 try{
 const blob=await renderStatusImage({name:'Fireball',units:[{price:18000}]},{
  storeName:'Safe Minds',shopUrl,showPrice:false,formatPrice:()=>'₦18,000',
  loadPhoto:async()=>({image,dispose(){calls.disposed++}})
 });
 assert.equal(blob.type,'image/jpeg');
 assert.equal(calls.draws.length,1);
 assert.equal(calls.draws[0][0],image);
 assert.equal(calls.draws[0].length,5);
 assert.equal(calls.texts.filter(s=>s==='store.mysalesofficial.com/safe-minds').length,1);
 assert.equal(calls.texts.includes('₦18,000'),false);
 assert.equal(calls.disposed,1);
 }finally{globalThis.document=documentBefore}
});

test('V5 browser scripts and manager entrypoints have valid JavaScript syntax',async()=>{
 const paths=['index.html','s/index.html','account/manage/index.html','account/create/index.html','login/index.html','manage/index.html'];
 for(const path of paths){
  const html=await read(path);
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length,path+' has script');
  for(const match of scripts){
   const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:match[1],encoding:'utf8'});
   assert.equal(r.status,0,path+' '+r.stderr.slice(0,450));
  }
 }
});
