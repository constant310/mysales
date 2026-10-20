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
  throw Error('Original product image unavailable for '+(product?.name||'product'));
 }
 try{
  // The approved Safe Minds reference is exactly 864 x 1536 (9:16).
  const W=864,H=1536,canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Your browser cannot create WhatsApp Status pictures.');

  // Deep evergreen header and calm pale background, matching the supplied reference.
  ctx.fillStyle='#EEF7F2';ctx.fillRect(0,0,W,H);
  const backdrop=ctx.createLinearGradient(0,0,W,H);
  backdrop.addColorStop(0,'#0A5B3B');
  backdrop.addColorStop(.5,'#00683F');
  backdrop.addColorStop(1,'#00472F');
  ctx.fillStyle=backdrop;
  ctx.beginPath();
  ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,565);
  ctx.bezierCurveTo(740,552,653,470,530,429);
  ctx.bezierCurveTo(270,352,151,521,0,389);
  ctx.closePath();ctx.fill();

  // Background embellishments stay behind the photograph, never across it.
  ctx.strokeStyle='rgba(90,190,130,.36)';
  ctx.lineWidth=56;
  ctx.beginPath();ctx.arc(934,-85,209,.25,Math.PI*1.05);ctx.stroke();
  ctx.strokeStyle='rgba(90,190,130,.21)';
  ctx.lineWidth=34;
  ctx.beginPath();ctx.arc(915,-95,275,.25,Math.PI*.95);ctx.stroke();
  ctx.fillStyle='rgba(209,234,219,.24)';
  ctx.beginPath();ctx.ellipse(770,1112,338,185,-.35,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.32)';
  ctx.beginPath();ctx.ellipse(55,1173,330,205,.24,0,Math.PI*2);ctx.fill();

  // Header typography and the small pill are deliberately placed as in the reference.
  ctx.fillStyle='#0E7850';rounded(ctx,48,49,314,45,16);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.font='700 22px Arial, sans-serif';
  ctx.fillText('AVAILABLE IN OUR STORE',68,79,277);
  ctx.fillStyle='#FFFFFF';
  textFit(ctx,String(storeName||'Our Store'),59,170,724,79,35);
  ctx.fillStyle='#D9F2E4';ctx.font='29px Arial, sans-serif';
  ctx.fillText('Discover something you will love',62,221,740);
  ctx.strokeStyle='#70BE91';ctx.lineWidth=13;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(718,175);ctx.lineTo(708,213);ctx.stroke();
  ctx.beginPath();ctx.moveTo(750,200);ctx.lineTo(722,226);ctx.stroke();

  // Single large white product card.
  ctx.save();
  ctx.shadowColor='rgba(0,62,33,.10)';ctx.shadowBlur=21;ctx.shadowOffsetY=8;
  ctx.fillStyle='#FFFFFF';rounded(ctx,48,254,768,1002,32);ctx.fill();
  ctx.restore();

  // Photo area is rectangular, with rounded corners and NO white wedges or overlays.
  // A contain fit preserves the entire item, including landscape and portrait photos.
  const photoX=62,photoY=269,photoW=740,photoH=816;
  ctx.fillStyle='#F5F9F6';rounded(ctx,photoX,photoY,photoW,photoH,25);ctx.fill();
  ctx.save();rounded(ctx,photoX,photoY,photoW,photoH,25);ctx.clip();
  const maxW=724,maxH=798;
  const scale=Math.min(maxW/sourceWidth,maxH/sourceHeight);
  const drawW=sourceWidth*scale,drawH=sourceHeight*scale;
  // A very subtle background gradient makes narrow photos intentional, not empty.
  const photoBg=ctx.createLinearGradient(photoX,photoY,photoX+photoW,photoY+photoH);
  photoBg.addColorStop(0,'#F9FBF9');photoBg.addColorStop(1,'#EEF5F0');
  ctx.fillStyle=photoBg;ctx.fillRect(photoX,photoY,photoW,photoH);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,photoX+(photoW-drawW)/2,photoY+(photoH-drawH)/2,drawW,drawH);
  ctx.restore();

  ctx.fillStyle='#E7ECE8';ctx.fillRect(81,1097,700,2);
  ctx.fillStyle='#074D34';ctx.font='800 52px Arial, sans-serif';
  const titleLines=wrapProductName(ctx,product?.name||'Product',704,2);
  const titleY=titleLines.length>1?1142:1159;
  titleLines.forEach((line,i)=>ctx.fillText(line,81,titleY+48*i,704));
  if(showPrice!==false){
   ctx.fillStyle='#007042';
   const priceY=titleLines.length>1?1233:1220;
   textFit(ctx,formatPrice(product.units[0].price),82,priceY,700,50,29);
  }

  // Distinct detached CTA strip below the card. URL occurs once and is not clickable in a JPG.
  ctx.fillStyle='#E3F0E8';rounded(ctx,48,1281,768,116,30);ctx.fill();
  ctx.fillStyle='#00613B';ctx.beginPath();ctx.arc(125,1339,39,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(106,1324);ctx.lineTo(112,1324);ctx.lineTo(117,1344);
  ctx.lineTo(139,1344);ctx.lineTo(147,1330);ctx.lineTo(116,1330);ctx.stroke();
  for(const x of [121,138]){ctx.beginPath();ctx.arc(x,1353,3,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#154F37';ctx.font='26px Arial, sans-serif';ctx.fillText('Shop here:',189,1330);
  const visibleUrl=String(shopUrl||'').replace(/^https?:\/\//i,'').replace(/\/$/,'');
  ctx.fillStyle='#064F34';
  textFit(ctx,visibleUrl,188,1368,505,27,17);
  ctx.fillStyle='#006A3C';ctx.beginPath();ctx.arc(751,1339,39,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=5;ctx.beginPath();
  ctx.moveTo(743,1323);ctx.lineTo(758,1339);ctx.lineTo(743,1355);ctx.stroke();

  // Curved mySales branded footer, matching the reference's proportions.
  const footer=ctx.createLinearGradient(0,1402,864,1536);
  footer.addColorStop(0,'#006F43');footer.addColorStop(1,'#004D33');
  ctx.fillStyle=footer;
  ctx.beginPath();ctx.moveTo(0,1398);
  ctx.bezierCurveTo(188,1468,345,1398,518,1406);
  ctx.bezierCurveTo(677,1407,786,1413,864,1445);
  ctx.lineTo(864,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
  ctx.fillStyle='#0DB353';rounded(ctx,309,1434,70,67,9);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.font='800 35px Arial, sans-serif';ctx.fillText('mS',321,1482);
  ctx.font='800 46px Arial, sans-serif';ctx.fillText('mySales',393,1486);

  return await new Promise((resolve,reject)=>{
   canvas.toBlob(result=>result?resolve(result):reject(Error('Could not export Status picture.')),'image/jpeg',.8);
  });
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
