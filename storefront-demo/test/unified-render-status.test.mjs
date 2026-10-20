import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderStatusImage,statusSharePayload,MAX_STATUS_ITEMS,rounded} from '../status-batch.mjs';

const base=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');

test('combination retains V5 account sign-in, the existing merchant Status UI and universal mySales poster',async()=>{
 const manager=await read('manage/index.html');
 const backend=await read('render-server.mjs');
 assert.match(manager,/import \{accessToken,requireAccount,logout\} from '\/auth\/client\.mjs'/);
 assert.match(manager,/import \{renderStatusImage,MAX_STATUS_ITEMS\} from '\/status-batch\.mjs'/);
 assert.match(manager,/id="status-section"/);
 assert.match(manager,/id="status-show-price"/);
 assert.match(manager,/renderStatusImage\(p,\{/);
 assert.match(manager,/loadPhoto:loadShareImage,formatPrice:currency/);
 assert.match(manager,/id="public-link"/);
 assert.match(manager,/MAX_STATUS_ITEMS/);
 assert.equal(MAX_STATUS_ITEMS,12);
 assert.match(backend,/MYSALES_V5_AUTH_STAGING/);
 assert.match(backend,/early-storefront-backend-v5-test/);
});
test('all prepared image shares omit duplicated link captions',async()=>{
 const manager=await read('manage/index.html');
 for(const snippet of ["navigator.share({files:statusFiles})","navigator.share({files:[file]})","navigator.share({files})"])
  assert.ok(manager.includes(snippet),snippet);
 assert.doesNotMatch(manager,/navigator\.share\(\{files:statusFiles[^}]*,\s*text:/);
 assert.doesNotMatch(manager,/navigator\.share\(\{files:statusFiles[^}]*,\s*url:/);
 assert.deepEqual(Object.keys(statusSharePayload([{name:'a.jpg'}])),['files']);
});
test('universal Status poster uses only actual original photo, one link, and hides optional price',async()=>{
 const calls={text:[],images:[],released:0};
 const ctx={
  beginPath(){},moveTo(){},arcTo(){},closePath(){},fill(){},fillRect(){},
  arc(){},ellipse(){},bezierCurveTo(){},clip(){},quadraticCurveTo(){},lineTo(){},stroke(){},save(){},restore(){},translate(){},rotate(){},
  fillText(t){calls.text.push(String(t));},drawImage(...args){calls.images.push(args);},
  measureText(s){return {width:String(s).length*17}},
  createLinearGradient(){return {addColorStop(){}}}
 };
 const canvas={width:0,height:0,getContext:()=>ctx,toBlob:cb=>cb(new Blob(['img'],{type:'image/jpeg'}))};
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas;}};
 const photo={naturalWidth:980,naturalHeight:1300};
 const link='https://store.mysalesofficial.com/safe-minds';
 try{
  const blob=await renderStatusImage({name:'Fireball',units:[{price:18000}]},{
   storeName:'Safe Minds',shopUrl:link,showPrice:false,
   formatPrice:()=> '₦18,000',
   loadPhoto:async()=>({image:photo,dispose(){calls.released++}})
  });
  assert.equal(blob.type,'image/jpeg');
  assert.equal(canvas.width,864);assert.equal(canvas.height,1536);
  assert.equal(calls.images.length,1);
  assert.equal(calls.images[0][0],photo);
  assert.equal(calls.images[0].length,5);
  assert.equal(calls.text.filter(x=>x.includes('store.mysalesofficial.com')).length,1);
  assert.equal(calls.text.includes('₦18,000'),false);
  assert.equal(calls.released,1);
 }finally{globalThis.document=previous;}
});


test('Status poster rounded cards use four valid corners without diagonal wedges',()=>{
 const operations=[];
 const ctx=Object.fromEntries(['beginPath','moveTo','lineTo','quadraticCurveTo','closePath'].map(name=>[
  name,(...args)=>operations.push([name,...args])
 ]));
 rounded(ctx,48,1282,768,111,36);
 assert.deepEqual(operations,[
  ['beginPath'],
  ['moveTo',84,1282],
  ['lineTo',780,1282],
  ['quadraticCurveTo',816,1282,816,1318],
  ['lineTo',816,1357],
  ['quadraticCurveTo',816,1393,780,1393],
  ['lineTo',84,1393],
  ['quadraticCurveTo',48,1393,48,1357],
  ['lineTo',48,1318],
  ['quadraticCurveTo',48,1282,84,1282],
  ['closePath']
 ]);
 assert.equal(operations.filter(entry=>entry[0]==='quadraticCurveTo').length,4);
});
