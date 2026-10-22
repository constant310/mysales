import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eligibleStatusProducts,MAX_STATUS_ITEMS,statusSharePayload,renderStatusImage} from '../status-batch.mjs';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');
const sale=(overrides={})=>({id:'p1',name:'Real product',published:true,image_path:'https://example.test/photo.jpg',units:[{price:7000}],...overrides});

test('bulk Status eligibility keeps only published items with real photos and prices',()=>{
 const result=eligibleStatusProducts([
  sale(),sale({id:'hidden',published:false}),sale({id:'unpictured',image_path:''}),
  sale({id:'no-units',units:[]}),sale({id:'second',name:'Another product'}),
 ]);
 assert.deepEqual(result.map(p=>p.id),['p1','second']);
 assert.equal(MAX_STATUS_ITEMS,12);
});

test('native share passes only prepared files, never a repeated URL caption',()=>{
 const files=[{name:'one.jpg'},{name:'two.jpg'}];
 assert.deepEqual(statusSharePayload(files),{files});
 assert.deepEqual(Object.keys(statusSharePayload(files)),['files']);
 assert.throws(()=>statusSharePayload([]),/Prepare the images/);
});

test('original product image is fitted, never cropped or synthesized, and URL is drawn once',async()=>{
 const calls={text:[],draw:[],disposals:0};
 const ctx={
  fillRect(){},beginPath(){},moveTo(){},arcTo(){},quadraticCurveTo(){},bezierCurveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},translate(){},rotate(){},arc(){},
  createLinearGradient(){return {addColorStop(){}};},
  measureText(t){return {width:String(t).length*10};},
  fillText(t){calls.text.push(String(t));},
  drawImage(...args){calls.draw.push(args);},
 };
 const canvas={width:0,height:0,getContext:()=>ctx,toBlob:callback=>callback(new Blob(['jpeg'],{type:'image/jpeg'}))};
 const previousDocument=globalThis.document;
 globalThis.document={createElement:type=>{assert.equal(type,'canvas');return canvas;}};
 const image={naturalWidth:1000,naturalHeight:2000};
 const url='https://store.mysalesofficial.com/safe-minds';
 try{
  const blob=await renderStatusImage(sale(),{
   storeName:'Safe Minds',shopUrl:url,showPrice:false,loadPhoto:async()=>({
    image,dispose:()=>{calls.disposals++;}
   }),formatPrice:()=> '₦7,000'
  });
  assert.equal(blob.type,'image/jpeg');
  assert.equal(canvas.width,864);
  assert.equal(canvas.height,1536);
  assert.equal(calls.draw.length,1);
  assert.equal(calls.draw[0][0],image);
  assert.equal(calls.draw[0].length,5); // Canvas drawImage(image,dx,dy,dw,dh), not the 9-arg crop form
  assert.equal(calls.text.filter(t=>t==='store.mysalesofficial.com/safe-minds').length,1);
  assert.equal(calls.text.includes('₦7,000'),false);
  assert.equal(calls.disposals,1);
 }finally{globalThis.document=previousDocument;}
});

test('manager exposes one-click multi-product Status editing and respects optional pricing',async()=>{
 const manager=await read('legacy/manage/index.html');
 const js=await read('status-batch.mjs');
 const server=await read('render-server.mjs');
 assert.match(manager,/id="status-products"/);
 assert.match(manager,/id="status-batch-dialog"/);
 assert.match(manager,/id="status-batch-items"/);
 assert.match(manager,/id="status-show-price"/);
 assert.match(manager,/id="status-share"/);
 assert.match(manager,/id="status-download"/);
 assert.match(manager,/import\('\/status-batch\.mjs'\)/);
 assert.match(js,/selected\.size>=MAX_STATUS_ITEMS/);
 assert.match(js,/files\.push\(new File/);
 assert.match(manager,/getPublicUrl:\(\)=>publicUrl\(\)/);
 assert.match(server,/'\.mjs':'text\/javascript; charset=utf-8'/);
 assert.doesNotMatch(manager,/navigator\.share\(\{files,title:currentStore\.name\+' products',text:shareProductText\(\)\}\)/);
 assert.match(js,/navigator\.share\(payload\)/);
 assert.doesNotMatch(js,/navigator\.share\(\{[^}]*text:/);
});
