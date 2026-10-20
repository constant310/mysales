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

export function rounded(ctx,x,y,w,h,r){
 // Use a closed, clockwise rounded rectangle. The previous arcTo path
 // skipped the bottom-left corner and doubled the top-left segment,
 // creating giant diagonal white wedges over the product photograph.
 const d=Math.min(Math.max(0,r),w/2,h/2);
 ctx.beginPath();
 ctx.moveTo(x+d,y);
 ctx.lineTo(x+w-d,y);
 ctx.quadraticCurveTo(x+w,y,x+w,y+d);
 ctx.lineTo(x+w,y+h-d);
 ctx.quadraticCurveTo(x+w,y+h,x+w-d,y+h);
 ctx.lineTo(x+d,y+h);
 ctx.quadraticCurveTo(x,y+h,x,y+h-d);
 ctx.lineTo(x,y+d);
 ctx.quadraticCurveTo(x,y,x+d,y);
 ctx.closePath();
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

/**
 * Original Safe Minds-inspired mySales Status template, 864x1536 (9:16).
 * Draw each layer in a fixed order: background -> product card -> genuine
 * product photo -> editable details -> shop CTA -> mySales footer.
 * Product photos are always contained; never stretched or cropped.
 */
export async function renderStatusImage(product,{storeName,shopUrl,showPrice,loadPhoto,formatPrice}) {
 const loaded=await loadPhoto(product);
 const photo=loaded?.image;
 const naturalW=photo?.naturalWidth||photo?.width||0;
 const naturalH=photo?.naturalHeight||photo?.height||0;
 if(!naturalW||!naturalH){
  loaded?.dispose?.();
  throw Error('Product photo unavailable for '+(product?.name||'this item'));
 }
 try {
  const W=864,H=1536;
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Your phone cannot prepare this Status design.');
  const circle=(x,y,r,color)=>{
   ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
   ctx.fillStyle=color;ctx.fill();
  };
  const pill=(x,y,w,h,r,color)=>{
   rounded(ctx,x,y,w,h,r);
   ctx.fillStyle=color;ctx.fill();
  };
  const titleLines=(value,maxWidth,maxLines=2)=>{
   const parts=String(value||'Product').trim().split(/\s+/);
   const lines=[];let current='';
   for(const word of parts){
    const candidate=current?current+' '+word:word;
    if(current&&ctx.measureText(candidate).width>maxWidth){
     lines.push(current);current=word;
    }else current=candidate;
   }
   if(current)lines.push(current);
   if(lines.length>maxLines){
    lines.length=maxLines;
    let last=lines[maxLines-1]||'';
    while(last.length>1&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
    lines[maxLines-1]=last+'…';
   }
   return lines.map(line=>{
    while(line.length>1&&ctx.measureText(line).width>maxWidth)line=line.slice(0,-2)+'…';
    return line;
   });
  };

  // Soft green and white backdrop from the supplied Safe Minds poster.
  ctx.fillStyle='#F0F7F2';ctx.fillRect(0,0,W,H);
  const head=ctx.createLinearGradient(0,0,W,525);
  head.addColorStop(0,'#125E3C');
  head.addColorStop(.6,'#075534');
  head.addColorStop(1,'#06502F');
  ctx.fillStyle=head;ctx.fillRect(0,0,W,565);
  ctx.strokeStyle='#287D4E';ctx.lineWidth=80;
  ctx.beginPath();ctx.arc(938,-50,207,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#F0F7F2';
  ctx.beginPath();ctx.moveTo(0,392);
  ctx.bezierCurveTo(140,560,330,504,510,492);
  ctx.bezierCurveTo(675,485,780,590,864,550);
  ctx.lineTo(864,1412);ctx.lineTo(0,1412);ctx.closePath();ctx.fill();

  // Hero text. Keep product title and price out of this area.
  pill(48,49,314,44,16,'#167047');
  ctx.font='700 22px Arial, sans-serif';ctx.fillStyle='#FFFFFF';
  ctx.fillText('AVAILABLE IN OUR STORE',69,80,285);
  ctx.fillStyle='#FFFFFF';
  textFit(ctx,String(storeName||'Our Store'),60,172,748,78,37);
  ctx.fillStyle='#E6F4EB';ctx.font='29px Arial, sans-serif';
  ctx.fillText('Discover something you will love',61,220,724);
  ctx.save();ctx.translate(710,204);ctx.rotate(.34);pill(0,0,14,49,7,'#70B68C');ctx.restore();
  ctx.save();ctx.translate(748,222);ctx.rotate(.8);pill(0,0,14,48,7,'#70B68C');ctx.restore();

  // Clean, floating white product card matching the reference layout.
  ctx.save();ctx.shadowColor='rgba(7,60,35,0.13)';
  ctx.shadowBlur=25;ctx.shadowOffsetY=10;
  pill(47,253,770,1005,37,'#FFFFFF');
  ctx.restore();
  // The photo area is gently tinted; no overlay ever covers the actual photo.
  pill(62,268,740,816,27,'#F8FBF9');
  const surface=ctx.createLinearGradient(62,268,802,1084);
  surface.addColorStop(0,'#FFFFFF');
  surface.addColorStop(.62,'#F7FAF8');
  surface.addColorStop(1,'#EDF6F2');
  pill(62,268,740,816,27,surface);

  // Contain-fit: every pixel of each real product photo remains visible.
  // For horizontal items this intentionally allows breathing room above/below.
  const frame={x:73,y:279,w:718,h:792};
  const scale=Math.min(frame.w/naturalW,frame.h/naturalH);
  const dw=naturalW*scale,dh=naturalH*scale;
  const px=frame.x+(frame.w-dw)/2,py=frame.y+(frame.h-dh)/2;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(photo,px,py,dw,dh);

  // Product details: original reference uses dark green type, NOT a price pill.
  ctx.fillStyle='#E4ECE6';ctx.fillRect(80,1097,704,2);
  ctx.fillStyle='#0A4930';
  const name=String(product?.name||'Product').trim();
  const nameFont=name.length>40?42:name.length>28?46:56;
  ctx.font='800 '+nameFont+'px Arial, sans-serif';
  const names=titleLines(name,704,2);
  const firstY=names.length>1?1147:1166;
  names.forEach((line,i)=>ctx.fillText(line,81,firstY+i*47,704));
  if(showPrice!==false){
   const unitPrice=product?.units?.[0]?.price;
   if(unitPrice!==undefined&&unitPrice!==null){
    ctx.fillStyle='#08613D';
    const priceText=formatPrice(unitPrice);
    textFit(ctx,priceText,81,names.length>1?1236:1223,694,55,31);
   }
  }

  // Soft mint, full-width shop bar with one shop link, no duplicate captions.
  pill(48,1282,768,111,36,'#E3F1E9');
  circle(121,1339,37,'#075C3A');
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=3.4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(104,1325);ctx.lineTo(110,1325);
  ctx.lineTo(115,1347);ctx.lineTo(139,1347);
  ctx.lineTo(147,1330);ctx.lineTo(113,1330);ctx.stroke();
  for(const cx of [118,139]){
   ctx.beginPath();ctx.arc(cx,1354,2.7,0,Math.PI*2);ctx.fillStyle='#FFFFFF';ctx.fill();
  }
  ctx.fillStyle='#17583A';ctx.font='26px Arial, sans-serif';
  ctx.fillText('Shop here:',190,1327);
  const readableLink=String(shopUrl||'').replace(/^https?:\/\//i,'').replace(/\/$/,'');
  ctx.fillStyle='#0B4F34';
  // Display the complete canonical URL whenever possible.
  textFit(ctx,readableLink,189,1364,523,25,15);
  circle(755,1339,37,'#087546');
  ctx.lineWidth=4;ctx.strokeStyle='#FFFFFF';
  ctx.beginPath();ctx.moveTo(744,1322);ctx.lineTo(761,1339);
  ctx.lineTo(744,1356);ctx.stroke();

  // White-to-green bottom sweep and centred mySales wordmark.
  ctx.fillStyle='#FFFFFF';ctx.beginPath();
  ctx.moveTo(0,1400);
  ctx.quadraticCurveTo(180,1433,439,1405);
  ctx.quadraticCurveTo(690,1395,864,1413);
  ctx.lineTo(864,1536);ctx.lineTo(0,1536);
  ctx.closePath();ctx.fill();
  const foot=ctx.createLinearGradient(0,1436,864,1536);
  foot.addColorStop(0,'#005633');foot.addColorStop(1,'#08462E');
  ctx.fillStyle=foot;ctx.beginPath();
  ctx.moveTo(0,1450);
  ctx.quadraticCurveTo(353,1379,864,1445);
  ctx.lineTo(864,1536);ctx.lineTo(0,1536);ctx.closePath();ctx.fill();
  pill(312,1435,68,69,8,'#14A354');
  ctx.fillStyle='#FFFFFF';ctx.font='800 32px Arial, sans-serif';
  ctx.fillText('mS',321,1481);
  ctx.fillStyle='#FFFFFF';ctx.font='800 45px Arial, sans-serif';
  ctx.fillText('mySales',396,1487);

  const blob=await new Promise((resolve,reject)=>{
   canvas.toBlob(value=>value?resolve(value):reject(Error('Unable to export Status picture.')),'image/jpeg',.82);
  });
  return blob;
 }finally{
  loaded?.dispose?.();
 }
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
