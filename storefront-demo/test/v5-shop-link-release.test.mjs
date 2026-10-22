import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {
 MAX_ENQUIRY_IMAGES,merchantStoreUrl,whatsappSellerLink,withStoreLink,
 prepareEnquiryPictures
} from '../shop/whatsapp-enquiry.mjs';
import {cleanStatusName,validStatusPrice,eligibleQuickFile} from '../status-quick-batch.mjs';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const prefix='https://wsxszbdvvtowmrnxdsrp.supabase.co/storage/v1/object/public/early-storefront-products/';
const sampleId='cd36ce00-337a-45d4-9233-9abcc19caa11';

test('buyer enquiry has direct merchant WhatsApp chat with labelled canonical shop URL',async()=>{
 const shop={public_handle:'safe-minds',whatsapp:'+234 803 123 4567'};
 const url=merchantStoreUrl(shop);
 const message=withStoreLink('Hello Safe Minds\n1 × Fire Blanket — ₦15,000',url);
 assert.equal(url,'https://store.mysalesofficial.com/safe-minds');
 assert.match(message,/\n\nShop: https:\/\/store\.mysalesofficial\.com\/safe-minds$/);
 assert.equal(withStoreLink(message,url),message,'shop address must not be duplicated');
 const chat=whatsappSellerLink(shop.whatsapp,message);
 assert.equal(new URL(chat).hostname,'wa.me');
 assert.equal(new URL(chat).pathname,'/2348031234567');
 assert.equal(new URL(chat).searchParams.get('text'),message);
 assert.equal(merchantStoreUrl({public_handle:'https://malicious.test'}),'');
 assert.equal(whatsappSellerLink('invalid',message),'');
 const html=await read('s/index.html');
 assert.match(html,/chatWithSeller\(basketMessage\(enquiryCartItems\(\)\),sellerNumber\(\)\)/);
 assert.match(html,/window\.location\.assign\(url\)/);
 assert.match(html,/href="\/account\/manage\/"[^>]*hidden/);
 assert.match(html,/id="send-photos"/);
 assert.match(html,/navigator\.share\(\{files:photos\}\)/);
 assert.doesNotMatch(html,/navigator\.share\(\{files:photos[^}]*text:/);
});

test('only five separate pictures with product and shop address, never a collage',async()=>{
 const former={fetch:globalThis.fetch,document:globalThis.document,Image:globalThis.Image,
   File:globalThis.File,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 let counter=0;
 const texts=[];
 globalThis.fetch=async()=>({
  ok:true,headers:{get:()=> 'image/jpeg'},blob:async()=>new Blob(['x'.repeat(180)],{type:'image/jpeg'})
 });
 URL.createObjectURL=()=> 'blob:status-'+(++counter);
 URL.revokeObjectURL=()=>{};
 globalThis.Image=class {naturalWidth=800;naturalHeight=600;
   set src(_){queueMicrotask(()=>this.onload?.());}};
 if(!globalThis.File)globalThis.File=class extends Blob {constructor(parts,name,options){super(parts,options);this.name=name;}};
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');const written=[];texts.push(written);
  return {getContext:()=>({
   fillRect(){},drawImage(){},fillText:t=>written.push(String(t)),
   measureText:t=>({width:String(t).length*19})
  }),toBlob:cb=>cb(new Blob(['sample JPEG'],{type:'image/jpeg'}))};
 }};
 try{
  const items=Array.from({length:6},(_,i)=>{
   const id=sampleId.slice(0,-1)+i;
   return {productId:String(i),name:'Product '+i,quantity:1,price:15000,unit:'piece',
    image_path:prefix+id+'/'+id+'/'+id+'.jpg'};
  });
  const files=await prepareEnquiryPictures('Safe Minds',items,'https://store.mysalesofficial.com/safe-minds');
  assert.equal(MAX_ENQUIRY_IMAGES,5);
  assert.equal(files.length,5);
  assert.equal(texts.length,5);
  for(const lines of texts){
   assert.equal(lines.filter(t=>t==='store.mysalesofficial.com/safe-minds').length,1);
   assert.ok(lines.includes('SHOP:'));
  }
 }finally{
  globalThis.fetch=former.fetch;globalThis.document=former.document;globalThis.Image=former.Image;
  globalThis.File=former.File;URL.createObjectURL=former.create;URL.revokeObjectURL=former.revoke;
 }
});

test('authenticated production V5 manager has quick-batch Status and safe legacy migration',async()=>{
 const mgr=await read('account/manage/index.html');
 const server=await read('render-server.mjs');
 const entry=await read('manage/index.html');
 assert.match(mgr,/id="status-quick-upload"/);
 assert.match(mgr,/id="status-quick-input"[^>]*type="file"[^>]*multiple/);
 assert.match(mgr,/setupQuickStatusBatch\(\{/);
 assert.match(mgr,/id="status-quick-save"/);
 assert.match(mgr,/id="status-quick-show-price"/);
 assert.match(mgr,/loadPhoto:loadShareImage/);
 assert.match(mgr,/requireAccount\(/);
 assert.match(mgr,/\/api\/v5\/merchant\//);
 assert.match(server,/\/account\/manage/);
 assert.match(entry,/readLegacyProof/);
 assert.equal(cleanStatusName('Fire_Blanket-6ft.jpg'),'Fire Blanket 6ft');
 assert.equal(validStatusPrice('15000'),15000);
 assert.equal(eligibleQuickFile({type:'image/jpeg',size:50000}),true);
 const moduleCode=(mgr.match(/<script type="module">([\s\S]*?)<\/script>/)||[])[1];
 assert.ok(moduleCode?.length>2000);
 for(const code of [moduleCode,await read('status-quick-batch.mjs')]){
  const proc=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
  assert.equal(proc.status,0,proc.stderr);
 }
});
