import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {enquiryPortraitLayout,prepareStatusPictures} from '../shop/whatsapp-enquiry.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('Status uses a genuine 9:16 portrait, centered product card and reserved footer',()=>{
 const layout=enquiryPortraitLayout(1,'status');
 assert.equal(layout.width,1080);
 assert.equal(layout.height,1920);
 assert.equal(layout.cards.length,1);
 assert.equal(layout.cards[0].x+layout.cards[0].w/2,layout.width/2);
 assert.ok(layout.cards[0].y>layout.header);
 assert.ok(layout.cards[0].y+layout.cards[0].h<layout.height-layout.footer);
 const enquiry=enquiryPortraitLayout(1);
 assert.equal(enquiry.height,1440,'regular enquiry canvas should not change');
});

test('Status source includes correct store branding but no stock or order quantity',async()=>{
 const source=await read('shop/whatsapp-enquiry.mjs');
 assert.match(source,/isStatus\?'AVAILABLE IN OUR STORE':'WHATSAPP PRODUCT ENQUIRY'/);
 assert.match(source,/isStatus\?'₦'\+Number\(p\.price\)/);
 assert.match(source,/p\.quantity\+' × '/);
 assert.match(source,/ctx\.fillText\('mS'/);
 assert.match(source,/ctx\.fillText\('mySales'/);
 assert.match(source,/const footY=height-188/);
 assert.match(source,/prepareEnquiryPicture\(storeName,\[\{/);
 assert.match(source,/\{variant:'status'\}/);
 assert.match(source,/if\(!photoProxyPath\(product\.image_path\)\)continue/);
});

test('Manager has a separate Status section only within authenticated dashboard',async()=>{
 const html=await read('manage/index.html');
 assert.match(html,/id="status-section"[^>]*hidden/);
 assert.match(html,/id="status-open"[^>]*hidden/);
 assert.match(html,/id="status-selection-count"/);
 assert.match(html,/id="status-products"/);
 assert.match(html,/id="status-previews"/);
 assert.match(html,/id="status-prepare"[^>]*disabled/);
 assert.match(html,/id="status-share"[^>]*disabled/);
 assert.match(html,/renderStatusPicker\(\)/);
 assert.match(html,/statusChosen=new Set\(\)/);
 assert.match(html,/photoProxyPath\(p\.image_path\)/);
 assert.match(html,/p\.published===true/);
 assert.match(html,/!p\.track_stock\|\|Number\(p\.stock\)>0/);
 assert.match(html,/navigator\.share\(\{files:statusFiles/);
 assert.match(html,/canShareEnquiryFiles\(statusFiles\)/);
 assert.match(html,/download\.download=file\.name/);
 assert.match(html,/WhatsApp → My Status/);
});

test('Status post uses no automatic posting or bearer token leaks',async()=>{
 const html=await read('manage/index.html');
 assert.doesNotMatch(html,/fetch\([^)]*api\/whatsapp\/post-status/);
 assert.match(html,/Posting requires your confirmation/);
 assert.match(html,/statusPreviewUrls\)URL\.revokeObjectURL/);
});

test('Status photo creation rejects absent product photos cleanly',async()=>{
 const files=await prepareStatusPictures('Safe Minds',[{
  id:'missing',name:'Without photo',image_path:'https://untrusted.example/photo.jpg',
  units:[{price:18000,name:'piece'}]
 }]);
 assert.deepEqual(files,[]);
});
