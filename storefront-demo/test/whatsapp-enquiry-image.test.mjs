import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {photoProxyPath,canShareEnquiryFile,canShareEnquiryFiles,enquiryItemsFromCart,photoSignature,enquiryPortraitLayout,prepareEnquiryPictures,MAX_ENQUIRY_IMAGES} from '../shop/whatsapp-enquiry.mjs';

const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const sampleId='cd36ce00-337a-45d4-9233-9abcc19caa11';
const sampleUrl='https://wsxszbdvvtowmrnxdsrp.supabase.co/storage/v1/object/public/early-storefront-products/'+sampleId+'/'+sampleId+'/'+sampleId+'.jpg';

test('only known safe public product pictures use the same-origin photo proxy',()=>{
 assert.equal(photoProxyPath(sampleUrl),'/api/catalogue-photo?key='+encodeURIComponent(sampleId+'/'+sampleId+'/'+sampleId+'.jpg'));
 assert.equal(photoProxyPath('https://evil.example/photo.jpg'),'');
 assert.equal(photoProxyPath('https://wsxszbdvvtowmrnxdsrp.supabase.co.evil.com/storage/v1/object/public/early-storefront-products/'+sampleId+'/'+sampleId+'/'+sampleId+'.jpg'),'');
 assert.equal(photoProxyPath('javascript:alert(1)'),'');
 assert.equal(photoProxyPath(sampleUrl+'/../../private-file'),'');
 assert.equal(photoProxyPath(''),'');
});

test('Web Share files require explicit browser support and cannot silently send',()=>{
 const file={name:'enquiry.jpg',type:'image/jpeg'};
 assert.equal(canShareEnquiryFile(file,{share:async()=>{},canShare:({files})=>files.length===1}),true);
 assert.equal(canShareEnquiryFile(file,{share:async()=>{}}),false);
 assert.equal(canShareEnquiryFile(null,{share:async()=>{},canShare:()=>true}),false);
 assert.equal(canShareEnquiryFile(file,{share:async()=>{},canShare:()=>false}),false);
});

test('enquiry basket photo preparation respects exact product and quantity',()=>{
 const products=[{id:'p1',image_path:sampleUrl,name:'Fireball'}];
 const cart=new Map([['p1:piece',{productId:'p1',quantity:2,price:6000,name:'Fireball',unit:'piece'}]]);
 const items=enquiryItemsFromCart(cart,products);
 assert.equal(items[0].image_path,sampleUrl);
 const signature=photoSignature('Safe Minds',items);
 assert.notEqual(signature,photoSignature('Safe Minds',[{...items[0],quantity:3}]));
 assert.notEqual(signature,photoSignature('Other store',items));
});

test('customer single-product and basket WhatsApp paths use real File sharing',async()=>{
 const page=await read('s/index.html');
 const helper=await read('shop/whatsapp-enquiry.mjs');
 assert.match(page,/navigator\.share\(\{files:photos,title:/);
 assert.match(page,/prepareEnquiryPictures\(store\.name,items\)/);
 assert.match(page,/sendPhotoEnquiry\(state\.files,message,number\)/);
 assert.match(page,/sendPhotoEnquiry\(photo\.files,message,number\)/);
 assert.match(page,/id="enquiry-save-list"/);
 assert.match(page,/id="enquiry-open-chat"/);
 assert.match(page,/href='https:\/\/wa\.me\/'\+number\+'\?text='/);
 assert.match(page,/id="enquiry-fallback"/);
 assert.match(helper,/canvas\.toBlob/);
 assert.match(helper,/new File\(\[blob\]/);
 assert.match(helper,/prepareEnquiryPictures\(storeName,items\)/);
 assert.match(helper,/if\(!imageCount\)return null/);
 assert.match(helper,/for\(const \[index,item\] of items\.slice\(0,MAX_ENQUIRY_IMAGES\)\.entries\(\)\)/);
 assert.match(helper,/return IMAGE_KEY\.test\(key\)/);
});

test('no claim of invisible automatic media attachment into a fixed WhatsApp recipient',async()=>{
 const page=await read('s/index.html');
 assert.match(page,/The buyer chooses/);
 assert.match(page,/attach the saved picture/i);
 assert.match(page,/if\(error\?\.name!=='AbortError'\)/);
});

test('WhatsApp enquiry pictures use portrait canvases and centered product cards',()=>{
 for(let count=1;count<=6;count++){
  const layout=enquiryPortraitLayout(count);
  assert.equal(layout.width,1080);
  assert.ok(layout.height>layout.width,'portrait: '+count);
  assert.equal(layout.cards.length,count);
  for(const card of layout.cards){
   assert.ok(card.x>=0&&card.y>layout.header,'card starts within content area');
   assert.ok(card.x+card.w<=layout.width,'card stays horizontally visible');
   assert.ok(card.y+card.h<layout.height-layout.footer,'card stays above footer');
  }
  if(count%2===1){
   const last=layout.cards.at(-1);
   assert.equal(last.x+last.w/2,layout.width/2,'single or last orphan card is centered');
  }
 }
 const single=enquiryPortraitLayout(1);
 assert.equal(single.height,1440);
 assert.equal(single.cards[0].x,130);
 assert.equal(single.cards[0].w,820);
});

test('multi-file sharing checks all selected attachments rather than just the first',()=>{
 const a={name:'fireball.jpg'},b={name:'blanket.jpg'};
 const device={share:()=>Promise.resolve(),canShare:({files})=>files.length===2};
 assert.equal(canShareEnquiryFiles([a,b],device),true);
 assert.equal(canShareEnquiryFiles([a],device),false);
 assert.equal(canShareEnquiryFiles([],device),false);
 assert.equal(canShareEnquiryFiles(null,device),false);
 assert.equal(MAX_ENQUIRY_IMAGES,10);
});

test('multiple enquiries generate separate files, not product collages',async()=>{
 const helper=await read('shop/whatsapp-enquiry.mjs');
 const page=await read('s/index.html');
 assert.match(helper,/if\(items\.length!==1\)return null/);
 assert.match(helper,/result\.push\(new File\(\[file\],name/);
 assert.match(helper,/await prepareEnquiryPicture\(storeName,\[item\]\)/);
 assert.match(page,/photos\.forEach\(\(file,index\)=>/);
 assert.match(page,/list\.append\(link\)/);
 assert.match(page,/save the photos below individually/i);
 assert.match(page,/navigator\.share\(\{files:photos/);
});
