import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const base=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,base),'utf8');

test('live branch lets merchants frame new and existing product photos without changing auth',async()=>{
 const manager=await read('legacy/manage/index.html');
 assert.match(manager,/id="photo-framer"/);
 assert.match(manager,/id="framer-canvas"/);
 assert.match(manager,/id="dialog-reframe"/);
 assert.match(manager,/photoFramerPromise=import\('\/photo-framing\.mjs'\)/);
 assert.match(manager,/const photo=await preparePhoto\(framedNewPhoto\|\|data\.photo\)/);
 assert.match(manager,/dialogPhotoFile=framed/);
 assert.match(manager,/headers:\{Authorization:'Bearer '\+token\}/);
 assert.match(manager,/fd\.append\('image',photo\)/);
 assert.match(manager,/validManagerToken\(token\)/);
 assert.doesNotMatch(manager,/requireAccount\(\)|import \{accessToken,requireAccount/);
});

test('framer uses fit-original by default and never edits the source file',async()=>{
 const code=await read('photo-framing.mjs');
 assert.match(code,/export function createPhotoFramer/);
 assert.match(code,/Math\.min\(\(SIDE\*\.94\)\/w,\(SIDE\*\.94\)\/h\)/);
 assert.match(code,/canvas\.toBlob/);
 assert.match(code,/new File\(\[blob\]/);
 assert.match(code,/URL\.revokeObjectURL/);
});

test('public storefront contains rather than crops image and enables fullscreen zoom',async()=>{
 const page=await read('s/index.html');
 assert.match(page,/\.grid-image\{position:absolute;inset:0;/);
 assert.match(page,/object-fit:contain;object-position:50% 50%/);
 assert.match(page,/id="photo-viewer"/);
 assert.match(page,/function openPhotoViewer\(product,source\)/);
 assert.match(page,/fillPhoto\(media,p,\(\)=>openPhotoViewer\(p,media\)\)/);
 assert.match(page,/add\.onclick=\(\)=>openSheet\(p,add\)/);
});

test('modified storefront and manager scripts are syntactically valid',async()=>{
 for(const path of ['legacy/manage/index.html','test/fixtures/legacy-shop.html']){
  const page=await read(path);
  const script=page.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'Expected classic script in '+path);
  assert.doesNotThrow(()=>typeof vm.SourceTextModule==='function'?new vm.SourceTextModule(script,{identifier:path}):new vm.Script(script,{filename:path}),path);
 }
 const framer=await read('photo-framing.mjs');
 if(typeof vm.SourceTextModule==='function') assert.doesNotThrow(()=>new vm.SourceTextModule(framer,{identifier:'photo-framing.mjs'}));
 else await assert.doesNotReject(()=>import('data:text/javascript,'+encodeURIComponent(framer)));
});
