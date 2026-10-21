import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {
 photoProxyPath,canShareEnquiryFile,canShareEnquiryFiles,enquiryItemsFromCart,
 photoSignature,enquiryPortraitLayout,prepareEnquiryPictures,MAX_ENQUIRY_IMAGES,
 merchantStoreUrl,whatsappSellerLink,withStoreLink
} from '../shop/whatsapp-enquiry.mjs';

const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const sampleId='cd36ce00-337a-45d4-9233-9abcc19caa11';
const sampleUrl='https://wsxszbdvvtowmrnxdsrp.supabase.co/storage/v1/object/public/early-storefront-products/'+sampleId+'/'+sampleId+'/'+sampleId+'.jpg';

test('product photos only use a verified same-origin photo proxy',()=>{
 assert.equal(photoProxyPath(sampleUrl),'/api/catalogue-photo?key='+encodeURIComponent(sampleId+'/'+sampleId+'/'+sampleId+'.jpg'));
 assert.equal(photoProxyPath('https://evil.example/photo.jpg'),'');
 assert.equal(photoProxyPath('https://wsxszbdvvtowmrnxdsrp.supabase.co.evil.com/storage/v1/object/public/early-storefront-products/'+sampleId+'/'+sampleId+'/'+sampleId+'.jpg'),'');
 assert.equal(photoProxyPath('javascript:alert(1)'),'');
 assert.equal(photoProxyPath(sampleUrl+'/../../private-file'),'');
});

test('Web Share requires explicit browser support and cannot silently send',()=>{
 const f={name:'enquiry.jpg',type:'image/jpeg'};
 assert.equal(canShareEnquiryFile(f,{share:async()=>{},canShare:({files})=>files.length===1}),true);
 assert.equal(canShareEnquiryFile(f,{share:async()=>{}}),false);
 assert.equal(canShareEnquiryFiles(null,{share:async()=>{},canShare:()=>true}),false);
 assert.equal(canShareEnquiryFiles([f],{share:async()=>{},canShare:()=>false}),false);
});

test('seller chat URL opens the actual merchant phone with fully encoded basket text',()=>{
 const store={public_handle:'safe-minds',whatsapp:'+234 803 123 4567'};
 const url=merchantStoreUrl(store);
 assert.equal(url,'https://store.mysalesofficial.com/safe-minds');
 assert.equal(merchantStoreUrl({slug:'safe-minds'}),url);
 assert.equal(merchantStoreUrl({public_handle:'https://evil.example/x'}),'');
 const msg=withStoreLink('Hello Safe Minds\nBallet 001 — ₦15,000',url);
 assert.equal(msg.split(url).length,2,'shop link appended exactly once');
 assert.equal(withStoreLink(msg,url),msg,'no duplicated shop link');
 const chat=whatsappSellerLink(store.whatsapp,msg);
 assert.ok(chat.startsWith('https://wa.me/2348031234567?text='));
 assert.equal(decodeURIComponent(new URL(chat).searchParams.get('text')),msg);
 assert.equal(whatsappSellerLink('abc',msg),'');
});

test('basket images preserve quantities and invalidate the cache for a changed store URL',()=>{
 const products=[{id:'p1',image_path:sampleUrl,name:'Fireball'}];
 const cart=new Map([['p1:piece',{productId:'p1',quantity:2,price:6000,name:'Fireball',unit:'piece'}]]);
 const items=enquiryItemsFromCart(cart,products);
 assert.equal(items[0].image_path,sampleUrl);
 const url='https://store.mysalesofficial.com/safe-minds';
 const signature=photoSignature('Safe Minds',items,url);
 assert.notEqual(signature,photoSignature('Safe Minds',[{...items[0],quantity:3}],url));
 assert.notEqual(signature,photoSignature('Other store',items,url));
 assert.notEqual(signature,photoSignature('Safe Minds',items,'https://store.mysalesofficial.com/other'));
});

test('main customer enquiry opens direct WhatsApp, image share is explicitly separate',async()=>{
 const page=await read('s/index.html');
 assert.match(page,/id="send"/);
 assert.match(page,/id="send-photos"/);
 assert.match(page,/id="sheet-share-photo"/);
 assert.match(page,/chatWithSeller\(basketMessage\(enquiryCartItems\(\)\),sellerNumber\(\)\)/);
 assert.match(page,/chatWithSeller\(selectedProductMessage\(\),sellerNumber\(\)\)/);
 assert.match(page,/window\.location\.assign\(url\)/);
 assert.match(page,/prepareEnquiryPictures\(store\.name,items,link\)/);
 assert.match(page,/navigator\.share\(\{files:photos\}\)/);
 assert.match(page,/sendPhotoEnquiry\(photo\.files,basketMessage\(selected\),sellerNumber\(\)\)/);
 assert.match(page,/sendPhotoEnquiry\(state\.files,selectedProductMessage\(\),sellerNumber\(\)\)/);
 assert.match(page,/showEnquiryFallback\(\[\],message,number,true\)/);
 assert.match(page,/if\(error\?\.name!=='AbortError'\)/);
 assert.doesNotMatch(page,/navigator\.share\(\{files:photos[^}]*text:/);
});

test('five separate product images include exactly the canonical store link inside each JPEG',async()=>{
 const helper=await read('shop/whatsapp-enquiry.mjs');
 assert.equal(MAX_ENQUIRY_IMAGES,5);
 assert.match(helper,/const result=\[\],seen=new Set\(\)/);
 assert.match(helper,/result\.length>=MAX_ENQUIRY_IMAGES/);
 assert.match(helper,/seen\.has\(item\.image_path\)/);
 assert.match(helper,/prepareEnquiryPicture\(storeName,\[item\],\{shopUrl\}\)/);
 assert.match(helper,/const visibleUrl=String\(shopUrl\|\|''\)/);
 assert.match(helper,/ctx\.fillText\(visibleUrl,32,height-46,width-64\)/);
 assert.match(helper,/result\.push\(new File\(\[file\],name/);
 assert.match(helper,/if\(!imageCount\)return null/);
});

test('enquiry canvases remain portrait and contain each product photo',()=>{
 for(let count=1;count<=MAX_ENQUIRY_IMAGES;count++){
  const layout=enquiryPortraitLayout(count);
  assert.equal(layout.width,1080);
  assert.ok(layout.height>layout.width);
  assert.equal(layout.cards.length,count);
  for(const card of layout.cards){
   assert.ok(card.x>=0&&card.y>layout.header);
   assert.ok(card.x+card.w<=layout.width);
   assert.ok(card.y+card.h<layout.height-layout.footer);
  }
  if(count%2===1){
   const last=layout.cards.at(-1);
   assert.equal(last.x+last.w/2,layout.width/2);
  }
 }
 const single=enquiryPortraitLayout(1);
 assert.equal(single.height,1440);
 assert.equal(single.cards[0].x,130);
 assert.equal(single.cards[0].w,820);
});

test('customer HTML modules and helper modules pass syntax verification',async()=>{
 const page=await read('s/index.html');
 const inline=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline?.length>1000);
 for(const source of [inline,await read('shop/whatsapp-enquiry.mjs')]){
  const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:source,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
 }
});
