import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('product photo editor is accessible for new and edited products',async()=>{
 const manager=await read('manage/index.html');
 assert.match(manager,/id="photo-framer"/);
 assert.match(manager,/id="framer-canvas"/);
 assert.match(manager,/id="framer-zoom"/);
 assert.match(manager,/id="framer-fit"/);
 assert.match(manager,/import \{createPhotoFramer\} from '\/photo-framing\.mjs'/);
 assert.match(manager,/photoFramer\.open\(file\)/);
 assert.match(manager,/const photo=await preparePhoto\(framedNewPhoto\|\|data\.photo\)/);
 assert.match(manager,/dialogPhotoFile=framed/);
 assert.match(manager,/fd\.append\('image',photo\)/);
});

test('photo editor preserves source file, defaults to full fit and saves a copy',async()=>{
 const framer=await read('photo-framing.mjs');
 assert.match(framer,/export function createPhotoFramer\(dialog\)/);
 assert.match(framer,/Math\.min\(\(SIDE\*\.94\)\/w,\(SIDE\*\.94\)\/h\)/);
 assert.match(framer,/context\.drawImage\(source/);
 assert.match(framer,/canvas\.toBlob\(resolve,'image\/jpeg'/);
 assert.match(framer,/new File\(\[blob\]/);
 assert.match(framer,/URL\.revokeObjectURL/);
 assert.doesNotMatch(framer,/fetch\(|navigator\.geolocation|serviceWorker/);
});

test('public product images have a safe contained square and fullscreen zoom viewer',async()=>{
 const page=await read('s/index.html');
 assert.match(page,/\.grid-image\{position:absolute;inset:0;/);
 assert.match(page,/object-fit:contain;object-position:50% 50%/);
 assert.match(page,/id="photo-viewer"/);
 assert.match(page,/id="viewer-image"/);
 assert.match(page,/function openPhotoViewer\(product,source\)/);
 assert.match(page,/fillPhoto\(media,p,\(\)=>openPhotoViewer\(p,media\)\)/);
 assert.match(page,/viewerPinchDistance/);
 assert.match(page,/function openSheet\(p,source\)/);
 assert.match(page,/add\.onclick=\(\)=>openSheet\(p,add\)/);
});
