import {renderStatusImage,MAX_STATUS_ITEMS} from './status-batch.mjs';

/*
 * Fast, client-side WhatsApp Status composer.
 * The selected files remain on the user's device until they explicitly
 * request saving products to the shop. Generated shares contain files only:
 * no duplicated URL captions, no automatic WhatsApp posting.
 */
export function cleanStatusName(filename) {
 return String(filename||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,110)||'New product';
}
export function validStatusPrice(raw) {
 const value=String(raw??'').trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(value))return null;
 const amount=Number(value);
 return Number.isFinite(amount)&&amount>=0&&amount<=10000000000?amount:null;
}
export function eligibleQuickFile(file) {
 return !!file && ['image/jpeg','image/png','image/webp'].includes(file.type) && file.size>0 && file.size<=18000000;
}
export function buildQuickSharePayload(files) {
 if(!Array.isArray(files)||!files.length)throw Error('Prepare your pictures before sharing.');
 return {files};
}
async function localPhoto(item) {
 const url=URL.createObjectURL(item.file);
 try {
  const img=new Image();
  img.decoding='async';
  img.src=url;
  await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw Error('Photo has no dimensions');
  return {image:img,dispose:()=>URL.revokeObjectURL(url)};
 }catch(err){URL.revokeObjectURL(url);throw Error('Could not read '+item.file.name+'. Choose a JPG, PNG or WebP photo.');}
}
const fileName=(item,index)=>{
 const slug=String(item.name||'product').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,34)||'product';
 return 'mysales-status-'+String(index+1).padStart(2,'0')+'-'+slug+'.jpg';
};

export function setupQuickStatusBatch({getStore,getShopUrl,formatPrice,saveToShop,onSaved,onShared}) {
 const $=id=>document.getElementById(id);
 const root=$('status-quick-upload');
 if(!root)throw Error('Quick Status form missing.');
 const input=$('status-quick-input');
 const list=$('status-quick-list');
 const previews=$('status-quick-previews');
 const prepare=$('status-quick-prepare');
 const share=$('status-quick-share');
 const save=$('status-quick-save');
 const feedback=$('status-quick-feedback');
 const showPrice=$('status-quick-show-price');
 const info=(msg,error=false)=>{feedback.textContent=msg;feedback.style.color=error?'#A13E35':'#52765D';};
 let items=[],prepared=[],outputUrls=[],busy=false,sequence=0;
 function clearOutputs(){
  for(const url of outputUrls)URL.revokeObjectURL(url);
  outputUrls=[];prepared=[];previews.replaceChildren();share.disabled=true;
 }
 function invalidate(){sequence++;clearOutputs();}
 function releaseRows(){
  for(const item of items)URL.revokeObjectURL(item.preview);
  items=[];
 }
 function refreshControls(){
  const valid=items.length&&items.every(item=>item.name.trim()&&(!showPrice.checked||validStatusPrice(item.price)!==null));
  const canSave=items.length&&items.every(item=>item.name.trim()&&validStatusPrice(item.price)!==null);
  prepare.disabled=busy||!valid;
  save.disabled=busy||!canSave||!items.some(item=>!item.published);
  share.disabled=busy||!prepared.length;
  input.disabled=busy;
  showPrice.disabled=busy;
  $('status-quick-count').textContent=items.length+' / '+MAX_STATUS_ITEMS+' photos';
 }
 function renderRows(){
  list.replaceChildren();
  items.forEach((item,index)=>{
   const card=document.createElement('div');card.className='quick-status-row';
   const image=document.createElement('img');image.src=item.preview;image.alt='Preview of '+item.name;
   const fields=document.createElement('div');fields.className='quick-status-fields';
   const label=document.createElement('label');label.textContent='Product '+(index+1)+' name';
   const name=document.createElement('input');name.type='text';name.maxLength=110;name.value=item.name;name.placeholder='Name of the product';name.setAttribute('aria-label','Name for product '+(index+1));
   name.oninput=()=>{item.name=name.value;invalidate();refreshControls();};
   const priceLabel=document.createElement('label');priceLabel.textContent='Price in ₦';
   const price=document.createElement('input');price.type='number';price.inputMode='decimal';price.min='0';price.max='10000000000';price.step='0.01';price.value=item.price;price.placeholder='e.g. 18000';price.setAttribute('aria-label','Price for product '+(index+1));
   price.oninput=()=>{item.price=price.value;invalidate();refreshControls();};
   const remove=document.createElement('button');remove.type='button';remove.className='quick-status-remove';remove.textContent='Remove';
   remove.setAttribute('aria-label','Remove product '+(index+1));
   remove.onclick=()=>{
    if(busy)return;
    URL.revokeObjectURL(item.preview);
    items.splice(index,1);invalidate();renderRows();refreshControls();info('Photo removed.');
   };
   const status=document.createElement('small');status.className='quick-status-save-state';status.textContent=item.published?'Added to shop ✓':item.savedId?'Finish saving to shop':'Status ready after preparation';
   fields.append(label,name,priceLabel,price,status,remove);card.append(image,fields);list.append(card);
  });
  $('status-quick-empty').hidden=items.length>0;
 }
 input.onchange=()=>{
  if(busy)return;
  const selected=Array.from(input.files||[]);
  input.value='';
  let added=0,skipped=0;
  for(const file of selected){
   if(items.length>=MAX_STATUS_ITEMS||!eligibleQuickFile(file)){skipped++;continue;}
   const preview=URL.createObjectURL(file);
   items.push({file,preview,name:cleanStatusName(file.name),price:'',savedId:null,photoSaved:false,published:false});
   added++;
  }
  invalidate();renderRows();refreshControls();
  info(added?added+' photo'+(added===1?'':'s')+' added. Enter the names and prices'+(skipped?'; '+skipped+' skipped (limit or format).':'.'):'No photos added. Use JPG, PNG or WebP, each under 18 MB.',!added);
 };
 showPrice.onchange=()=>{invalidate();refreshControls();info('Price display changed. Recreate pictures to apply it.');};
 prepare.onclick=async()=>{
  if(busy||prepare.disabled)return;
  const store=getStore();
  if(!store){info('Open your mySales store first.',true);return;}
  const shopUrl=getShopUrl();
  if(!shopUrl){info('Your store link is not available yet.',true);return;}
  const current=++sequence;
  clearOutputs();busy=true;refreshControls();
  const results=[];
  try{
   for(let index=0;index<items.length;index++){
    if(current!==sequence)return;
    const item=items[index];
    info('Designing '+(index+1)+' of '+items.length+' pictures on your phone…');
    const amount=validStatusPrice(item.price);
    if(!item.name.trim()||(showPrice.checked&&amount===null))throw Error('Enter a name and valid price for every picture.');
    const product={name:item.name.trim(),units:[{price:amount??0}]};
    const blob=await renderStatusImage(product,{
     storeName:store.name||'Our store',shopUrl,showPrice:showPrice.checked,
     formatPrice,loadPhoto:()=>localPhoto(item)
    });
    if(current!==sequence)return;
    results.push(new File([blob],fileName(item,index),{type:'image/jpeg'}));
    // Give the browser one frame to paint progress and keep lower-end phones responsive.
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   prepared=results;
   results.forEach((file,index)=>{
    const url=URL.createObjectURL(file);outputUrls.push(url);
    const figure=document.createElement('figure');figure.className='status-preview';
    const image=document.createElement('img');image.src=url;image.alt='Status design '+(index+1);image.loading='lazy';
    const caption=document.createElement('figcaption');caption.textContent=items[index].name;
    const download=document.createElement('a');download.href=url;download.download=file.name;download.textContent='Download picture';
    figure.append(image,caption,download);previews.append(figure);
   });
   info(results.length+' separate portraits ready. Tap Share → WhatsApp → My Status and confirm. To add a tappable link, use a WhatsApp link sticker.');
  }catch(err){clearOutputs();info('Unable to create pictures: '+err.message,true);}
  finally{busy=false;refreshControls();}
 };
 share.onclick=()=>{
  if(!prepared.length)return;
  const payload=buildQuickSharePayload(prepared);
  if(typeof navigator.share!=='function'||(navigator.canShare&&!navigator.canShare(payload))){
   info('Your browser cannot share these photos together. Download them above, then select the files in WhatsApp Status.',true);return;
  }
  try{
   Promise.resolve(navigator.share(payload))
    .then(()=>{onShared?.();info('Photos handed to your phone. Choose My Status and confirm posting in WhatsApp.');})
    .catch(err=>{if(err?.name!=='AbortError')info('Could not open the share menu. Download the pictures and post using WhatsApp.',true);});
  }catch(err){info('Sharing unavailable. Download the pictures and post using WhatsApp.',true);}
 };
 save.onclick=async()=>{
  if(busy||save.disabled)return;
  if(!saveToShop){info('Saving to your shop is not available.',true);return;}
  const pending=items.filter(item=>!item.published);
  if(!pending.length)return;
  // Saving is intentionally separate so sharing locally never waits for Supabase.
  busy=true;refreshControls();let done=0;const failures=[];
  try{
   // Two network workers reduce wait time without overwhelming the store backend.
   let next=0;
   const worker=async()=>{
    while(next<pending.length){
     const index=next++;
     const item=pending[index];
     info('Saving product '+(index+1)+' of '+pending.length+' to your shop…');
     try{await saveToShop(item);done++;}
     catch(err){failures.push(item.name+': '+(err.message||'Could not save'));}
    }
   };
   await Promise.all([worker(),worker()]);
   renderRows();
   if(done){try{await onSaved?.();}catch(err){failures.push('Shop refresh: '+(err.message||'Try refreshing'));}}
   info(done+' saved to your shop.'+(failures.length?' '+failures.length+' need attention: '+failures.slice(0,2).join('; '):'')+(prepared.length?' Your Status designs remain ready.':''),Boolean(failures.length));
  }finally{busy=false;refreshControls();}
 };
 window.addEventListener('pagehide',()=>{
  invalidate();releaseRows();
 });
 renderRows();refreshControls();
 return {refresh:refreshControls};
}
