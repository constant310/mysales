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
 const img=loaded?.image;
 const sourceWidth=img?.naturalWidth||img?.width||0;
 const sourceHeight=img?.naturalHeight||img?.height||0;
 if(!sourceWidth||!sourceHeight){
  loaded?.dispose?.();
  throw Error('Original product image unavailable for '+product.name);
 }
 try{
  // 864 × 1536 matches the supplied Safe Minds-style portrait layout.
  // It is 36% fewer pixels to process than the old 1080 × 1920 export.
  const W=864,H=1536,canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Your browser cannot make Status pictures.');
  ctx.fillStyle='#F0F7F3';ctx.fillRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#07512F');bg.addColorStop(.63,'#00643B');bg.addColorStop(1,'#004E32');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,530);
  ctx.fillStyle='#0E7B4B';
  ctx.beginPath();ctx.arc(850,-65,182,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#358D62';ctx.lineWidth=68;
  ctx.beginPath();ctx.arc(883,-60,179,1.15,3.55);ctx.stroke();
  ctx.fillStyle='#EAF6EF';ctx.beginPath();ctx.moveTo(0,386);
  ctx.quadraticCurveTo(150,480,376,433);ctx.quadraticCurveTo(670,510,864,440);
  ctx.lineTo(864,1536);ctx.lineTo(0,1536);ctx.closePath();ctx.fill();

  // Header and brand hierarchy.
  ctx.fillStyle='#13744A';rounded(ctx,48,50,320,45,15);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.font='700 22px Arial, sans-serif';
  ctx.fillText('AVAILABLE IN OUR STORE',67,80);
  ctx.fillStyle='#FFFFFF';
  textFit(ctx,storeName||'Our Store',59,174,750,71,34);
  ctx.font='30px Arial, sans-serif';ctx.fillStyle='#DBF5E5';
  ctx.fillText('Discover something you will love',61,224,740);
  ctx.fillStyle='#62BE86';ctx.save();ctx.translate(734,175);ctx.rotate(.35);
  rounded(ctx,0,0,17,56,10);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(780,193);ctx.rotate(.8);rounded(ctx,0,0,16,52,10);ctx.fill();ctx.restore();

  // Main white product card: no cropping or zooming of the merchant's real photo.
  ctx.save();ctx.shadowColor='rgba(14,64,43,.13)';ctx.shadowBlur=23;ctx.shadowOffsetY=9;
  ctx.fillStyle='#FFFFFF';rounded(ctx,48,254,768,997,33);ctx.fill();ctx.restore();
  ctx.fillStyle='#F7FAF8';rounded(ctx,62,269,740,812,26);ctx.fill();
  const maxW=720,maxH=792;
  const scale=Math.min(maxW/sourceWidth,maxH/sourceHeight);
  const drawW=sourceWidth*scale,drawH=sourceHeight*scale;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,432-drawW/2,276+(792-drawH)/2,drawW,drawH);

  ctx.fillStyle='#E4EBE6';ctx.fillRect(81,1098,700,2);
  ctx.fillStyle='#084A30';ctx.font='800 48px Arial, sans-serif';
  const titleLines=wrapProductName(ctx,product.name||'Product',704,2);
  titleLines.forEach((line,index)=>ctx.fillText(line,81,1152+index*48,704));
  if(showPrice){
   const y=titleLines.length===2?1240:1219;
   ctx.fillStyle='#006C3C';
   textFit(ctx,formatPrice(product.units[0].price),82,Math.min(y,1234),700,48,31);
  }

  // Green-tinted link strip. Printed text isn't clickable; show it once only.
  ctx.fillStyle='#E4F2E9';rounded(ctx,48,1274,768,123,31);ctx.fill();
  ctx.fillStyle='#055735';ctx.beginPath();ctx.arc(125,1336,38,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(105,1319);ctx.lineTo(111,1319);ctx.lineTo(116,1342);
  ctx.lineTo(140,1342);ctx.lineTo(148,1324);ctx.lineTo(115,1324);ctx.stroke();
  for(const x of [120,139]){ctx.beginPath();ctx.arc(x,1351,3,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#104D35';ctx.font='26px Arial, sans-serif';ctx.fillText('Shop here:',189,1326);
  ctx.font='700 26px Arial, sans-serif';
  textFit(ctx,shopUrl||'',188,1362,590,26,18);
  ctx.fillStyle='#046A3E';ctx.beginPath();ctx.arc(750,1336,37,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=5;ctx.beginPath();
  ctx.moveTo(740,1319);ctx.lineTo(756,1336);ctx.lineTo(740,1353);ctx.stroke();

  // Matching green footer and mySales identity.
  ctx.fillStyle='#00633B';ctx.beginPath();ctx.moveTo(0,1430);
  ctx.quadraticCurveTo(330,1375,864,1450);ctx.lineTo(864,1536);ctx.lineTo(0,1536);ctx.closePath();ctx.fill();
  ctx.fillStyle='#14A750';rounded(ctx,311,1441,65,59,9);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.font='800 31px Arial, sans-serif';ctx.fillText('mS',322,1483);
  ctx.font='800 44px Arial, sans-serif';ctx.fillText('mySales',394,1486);

  const blob=await new Promise((resolve,reject)=>{
   canvas.toBlob(value=>value?resolve(value):reject(Error('Image export failed.')),'image/jpeg',.8);
  });
  // The canvas and decoded image can now be collected before the next item.
  canvas.width=1;canvas.height=1;
  return blob;
 }finally{loaded?.dispose?.();}
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
