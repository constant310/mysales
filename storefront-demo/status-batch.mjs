/*
 * mySales WhatsApp Status batches.
 * Each selected product becomes its own 9:16 image, using only the merchant's
 * real photo. A shop link is drawn once on each image; the native share payload
 * deliberately carries files only (no duplicated URL caption).
 */
export const MAX_STATUS_ITEMS=12;

export function eligibleStatusProducts(products) {
 return (products||[]).filter(p=>p?.published===true && p?.image_path && p?.units?.[0]);
}

export function statusSharePayload(files) {
 if(!Array.isArray(files)||!files.length)throw Error('Prepare the images first.');
 return {files};
}

function rounded(ctx,x,y,w,h,r){
 const d=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+d,y);ctx.arcTo(x+w,y,x+w,y+h,d);
 ctx.arcTo(x+w,y+h,x,y+h,d);ctx.arcTo(x,y,x+w,y,d);
 ctx.arcTo(x,y,x+w,y,d);ctx.closePath();
}
function textFit(ctx,text,x,y,width,size=60,min=26) {
 let fontSize=size;
 do {ctx.font='800 '+fontSize+'px Arial, sans-serif';fontSize-=2;}
 while(ctx.measureText(text).width>width && fontSize>=min);
 let value=text;
 while(value.length>1&&ctx.measureText(value).width>width)value=value.slice(0,-2)+'…';
 ctx.fillText(value,x,y,width);
}
function wrapProductName(ctx,text,width,maxLines=2){
 const words=String(text).trim().split(/\s+/),lines=[];let line='';
 for(const word of words) {
  const next=line?line+' '+word:word;
  if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){
  lines.length=maxLines;let last=lines[maxLines-1];
  while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);
  lines[maxLines-1]=last+'…';
 }
 return lines;
}

export async function renderStatusImage(product,{storeName,shopUrl,showPrice,loadPhoto,formatPrice}) {
 const loaded=await loadPhoto(product);
 if(!loaded?.image?.naturalWidth||!loaded?.image?.naturalHeight){
  loaded?.dispose?.();
  throw Error('Original product image unavailable for '+product.name);
 }
 try{
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Your phone cannot prepare WhatsApp Status pictures.');
  const width=1080;
  ctx.fillStyle='#F1F7F1';ctx.fillRect(0,0,width,1920);
  const gradient=ctx.createLinearGradient(0,0,1080,400);
  gradient.addColorStop(0,'#104A30');gradient.addColorStop(1,'#14663F');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,350);
  ctx.fillStyle='#DCF4E3';ctx.font='700 29px Arial, sans-serif';ctx.fillText('AVAILABLE IN OUR STORE',60,76);
  ctx.fillStyle='#FFFFFF';
  textFit(ctx,storeName||'Our store',59,177,965,77,34);
  ctx.font='32px Arial, sans-serif';ctx.fillStyle='#DDF4E4';ctx.fillText('Discover something you will love',60,248);

  // Light product card, with an image-fit region. Never crop, invent or retouch photos.
  ctx.fillStyle='#FFFFFF';rounded(ctx,36,322,1008,1262,38);ctx.fill();
  ctx.fillStyle='#F5F9F5';rounded(ctx,58,349,964,1010,24);ctx.fill();
  const img=loaded.image;
  const maxW=922,maxH=980,scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight);
  const drawW=img.naturalWidth*scale,drawH=img.naturalHeight*scale;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,(width-drawW)/2,364+(976-drawH)/2,drawW,drawH);
  ctx.fillStyle='#E4EEE6';ctx.fillRect(68,1381,944,2);
  ctx.fillStyle='#203E2B';ctx.font='800 57px Arial, sans-serif';
  const lines=wrapProductName(ctx,product.name,936,2);
  lines.forEach((line,index)=>ctx.fillText(line,74,1450+index*61,936));
  if(showPrice){
   ctx.fillStyle='#148044';textFit(ctx,formatPrice(product.units[0].price),74,1555,923,53,35);
  }

  ctx.fillStyle='#E1F0E7';rounded(ctx,46,1610,988,166,27);ctx.fill();
  ctx.fillStyle='#0B5733';ctx.font='800 36px Arial, sans-serif';ctx.fillText('SHOP HERE',78,1669);
  ctx.font='32px Arial, sans-serif';
  // Exactly ONE link occurrence, in the picture footer, never in native share text.
  textFit(ctx,shopUrl,78,1733,920,34,20);

  ctx.fillStyle='#0C5734';ctx.fillRect(0,1800,width,120);
  ctx.fillStyle='#1CA34B';rounded(ctx,360,1826,75,68,8);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.font='800 34px Arial, sans-serif';ctx.fillText('mS',377,1874);
  ctx.fillStyle='#FFFFFF';ctx.font='800 47px Arial, sans-serif';ctx.fillText('mySales',450,1874);

  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
   image=>image?resolve(image):reject(Error('Unable to export this status picture.')),
   'image/jpeg',.86));
  return blob;
 }finally{loaded.dispose();}
}

export function setupStatusBatch({getProducts,getStore,getPublicUrl,loadPhoto,formatPrice,onShare}) {
 const $=id=>document.getElementById(id);
 const dialog=$('status-batch-dialog');
 if(!dialog||!$('status-products'))throw Error('WhatsApp Status controls are missing.');
 const selected=new Set();let files=[],busy=false,serial=0,previewUrl='';
 const info=(message,error=false)=>{
  $('status-batch-feedback').textContent=message;
  $('status-batch-feedback').style.color=error?'#aa392b':'#507961';
 };
 const revoke=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';};
 const invalidate=()=>{
  serial++;files=[];revoke();
  $('status-batch-preview').hidden=true;$('status-batch-preview').removeAttribute('src');
  $('status-share').disabled=true;$('status-download').disabled=true;
  $('status-prepare').disabled=!selected.size||busy;
 };
 const eligible=()=>eligibleStatusProducts(getProducts());
 const current=()=>eligible().filter(p=>selected.has(p.id)).slice(0,MAX_STATUS_ITEMS);
 const sync=()=>{
  $('status-batch-count').textContent=selected.size+' of '+MAX_STATUS_ITEMS+' selected';
  invalidate();
  if(!busy)info(selected.size?'Prepare '+selected.size+' separate Status images.':'Select products to create Status images.');
 };
 const render=()=>{
  const host=$('status-batch-items');host.replaceChildren();
  const q=$('status-batch-search').value.toLowerCase().trim();
  const available=eligible().filter(p=>[p.name,p.category].some(t=>String(t||'').toLowerCase().includes(q)));
  if(!available.length){
   const p=document.createElement('p');p.textContent='No matching published products with photos.';p.className='hint';p.style.padding='14px';host.append(p);return;
  }
  for(const p of available){
   const label=document.createElement('label');label.className='share-product-option';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(p.id);
   checkbox.setAttribute('aria-label','Create WhatsApp Status for '+p.name);
   checkbox.onchange=()=>{
    if(checkbox.checked){
     if(selected.size>=MAX_STATUS_ITEMS){checkbox.checked=false;info('Up to '+MAX_STATUS_ITEMS+' images per batch. Create another batch for more.',true);return;}
     selected.add(p.id);
    }else selected.delete(p.id);
    sync();
   };
   label.append(checkbox);
   const image=document.createElement('img');
   const src=String(p.image_path||'');
   if(src.startsWith('https://')){image.src=src;image.alt='';image.loading='lazy';label.append(image);}
   const detail=document.createElement('span');detail.className='share-option-text';
   const name=document.createElement('strong');name.textContent=p.name;
   const price=document.createElement('small');price.textContent=formatPrice(p.units[0].price);
   detail.append(name,price);label.append(detail);host.append(label);
  }
 };
 function open(){
  if(!getStore()||getStore().status!=='published'){info('Publish your store before preparing public WhatsApp Status links.',true);return;}
  selected.clear();$('status-batch-search').value='';$('status-show-price').checked=true;
  sync();render();if(!dialog.open)dialog.showModal();
 }
 $('status-products').onclick=open;
 $('status-batch-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{selected.clear();invalidate();});
 $('status-batch-search').oninput=render;
 $('status-batch-all').onclick=()=>{
  const q=$('status-batch-search').value.toLowerCase().trim();
  for(const p of eligible().filter(p=>String(p.name+' '+(p.category||'')).toLowerCase().includes(q))){
   if(selected.size>=MAX_STATUS_ITEMS)break;selected.add(p.id);
  }
  render();sync();
 };
 $('status-batch-clear').onclick=()=>{selected.clear();render();sync();};
 $('status-show-price').onchange=sync;
 $('status-prepare').onclick=async()=>{
  if(busy||!selected.size)return;
  const picked=current();const request=++serial;
  busy=true;files=[];revoke();$('status-prepare').disabled=true;
  $('status-share').disabled=true;$('status-download').disabled=true;
  const name=String(getStore()?.name||'Store').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,24)||'store';
  const shopUrl=getPublicUrl(),showPrice=$('status-show-price').checked;
  try {
   for(let index=0;index<picked.length;index++){
    info('Preparing image '+(index+1)+' of '+picked.length+'…');
    const item=picked[index];
    const blob=await renderStatusImage(item,{storeName:getStore().name,shopUrl,showPrice,loadPhoto,formatPrice});
    if(serial!==request)return;
    files.push(new File([blob],name+'-status-'+String(index+1).padStart(2,'0')+'.jpg',{type:'image/jpeg'}));
   }
   previewUrl=URL.createObjectURL(files[0]);
   $('status-batch-preview').src=previewUrl;$('status-batch-preview').hidden=false;
   $('status-share').disabled=false;$('status-download').disabled=false;
   info('Ready: '+files.length+' separate photos. Choose WhatsApp → My Status in your phone’s share menu. Add a clickable link sticker inside WhatsApp if needed.');
  }catch(error){
   files=[];info('Could not prepare the batch: '+error.message,true);
  }finally{busy=false;$('status-prepare').disabled=!selected.size;}
 };
 $('status-share').onclick=()=>{
  if(!files.length)return;
  // Do not add title, text or URL: browsers/WhatsApp can repeat captions per photo.
  const payload=statusSharePayload(files);
  if(typeof navigator.share!=='function'||(typeof navigator.canShare==='function'&&!navigator.canShare(payload))){
   info('Your browser cannot share these files together. Download the images, then select them in WhatsApp Status.',true);return;
  }
  try{
   Promise.resolve(navigator.share(payload))
    .then(()=>{onShare?.();info('Pictures handed to your phone. Select My Status in WhatsApp and confirm posting.');})
    .catch(error=>{if(error?.name!=='AbortError')info('Sharing unavailable. Save the pictures and select them from WhatsApp Status.',true);});
  }catch{info('Sharing failed. Save the pictures and select them from WhatsApp Status.',true);}
 };
 $('status-download').onclick=()=>{
  if(!files.length)return;
  for(const file of files){
   const url=URL.createObjectURL(file),a=document.createElement('a');
   a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),12000);
  }
  info('Download requested for '+files.length+' images. Some browsers ask for permission to download multiple files. Add the pictures in WhatsApp Status.');
 };
 $('status-copy-link').onclick=async()=>{
  try{await navigator.clipboard.writeText(getPublicUrl());info('Shop link copied. Add it using a WhatsApp Status link sticker.');}
  catch{window.prompt('Copy your shop link:',getPublicUrl());}
 };
 return {open};
}
