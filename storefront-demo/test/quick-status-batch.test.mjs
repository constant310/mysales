import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {
 cleanStatusName,validStatusPrice,eligibleQuickFile,buildQuickSharePayload
} from '../status-quick-batch.mjs';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('quick composer uses real phone pictures, sensible names, and bounded batch sizes',async()=>{
 assert.equal(cleanStatusName('Turkish_Fire_Ball-1.png'),'Turkish Fire Ball 1');
 assert.equal(cleanStatusName('photo.webp'),'photo');
 assert.equal(eligibleQuickFile({type:'image/jpeg',size:1600000}),true);
 assert.equal(eligibleQuickFile({type:'image/webp',size:18000000}),true);
 assert.equal(eligibleQuickFile({type:'image/gif',size:100}),false);
 assert.equal(eligibleQuickFile({type:'image/png',size:19000000}),false);
 const src=await source('status-quick-batch.mjs');
 assert.match(src,/items\.length>=MAX_STATUS_ITEMS/);
 assert.match(src,/renderStatusImage\(product,/);
 assert.match(src,/loadPhoto:\(\)=>localPhoto\(item\)/);
 assert.match(src,/await Promise\.all\(\[worker\(\),worker\(\)\]\)/);
});

test('prices are validated and sharing never duplicates the shop link caption',()=>{
 assert.equal(validStatusPrice('18000'),18000);
 assert.equal(validStatusPrice('0'),0);
 assert.equal(validStatusPrice('18000.50'),18000.5);
 for(const invalid of ['',null,'abc','-1','Infinity','18000.999','999999999999'])assert.equal(validStatusPrice(invalid),null);
 const files=[{name:'1.jpg'},{name:'2.jpg'}];
 assert.deepEqual(buildQuickSharePayload(files),{files});
 assert.deepEqual(Object.keys(buildQuickSharePayload(files)),['files']);
 assert.throws(()=>buildQuickSharePayload([]));
});

test('authenticated merchant UI exposes direct batch even when no catalogue products exist',async()=>{
 const h=await source('manage/index.html');
 for(const attr of ['id="status-quick-input"','multiple','id="status-quick-list"',
  'id="status-quick-prepare"','id="status-quick-share"','id="status-quick-save"',
  'id="status-quick-show-price"','id="status-quick-previews"'])assert.ok(h.includes(attr),attr);
 assert.match(h,/setupQuickStatusBatch\(\{/);
 assert.match(h,/\$\('status-section'\)\.hidden=false/);
 assert.match(h,/item\.savedId=created\.id/);
 assert.match(h,/if\(!item\.photoSaved\)/);
 assert.match(h,/await post\('publish',\{productId:item\.savedId,published:true\}\)/);
 assert.doesNotMatch(h,/fetch\([^)]*api\/whatsapp\/post-status/);
});

test('quick module and inline manager module parse as JavaScript modules',async()=>{
 const moduleSource=await source('status-quick-batch.mjs');
 const page=await source('manage/index.html');
 const inline=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline&&inline.length>2000,'inline merchant module located');
 for(const input of [moduleSource,inline]){
  const check=spawnSync(process.execPath,['--check','--input-type=module'],{input,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
 }
});

test('template is 9:16, contains branding once and fits photos without cropping',async()=>{
 const renderer=await source('status-batch.mjs');
 assert.match(renderer,/W=864,H=1536/);
 assert.match(renderer,/Math\.min\(maxW\/sourceWidth,maxH\/sourceHeight\)/);
 assert.match(renderer,/canvas\.toBlob/);
 assert.match(renderer,/'image\/jpeg',\.8/);
 assert.equal((renderer.match(/textFit\(ctx,shopUrl/g)||[]).length,1);
});
