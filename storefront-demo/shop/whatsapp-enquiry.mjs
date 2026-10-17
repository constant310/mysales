/* mySales buyer-side WhatsApp image attachment support.
   Never treat wa.me text links as a way to attach media; use Web Share files.
   Product photos are loaded from the already whitelisted same-origin photo proxy. */
const STORAGE_ORIGIN='https://wsxszbdvvtowmrnxdsrp.supabase.co';
const IMAGE_PREFIX='/storage/v1/object/public/early-storefront-products/';
const IMAGE_KEY=/^([a-f0-9-]{36}\/){2}[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp)$/i;

export function photoProxyPath(url){
 try{
  const parsed=new URL(String(url||''));
  if(parsed.origin!==STORAGE_ORIGIN||!parsed.pathname.startsWith(IMAGE_PREFIX))return '';
  const key=decodeURIComponent(parsed.pathname.slice(IMAGE_PREFIX.length));
  return IMAGE_KEY.test(key)?'/api/catalogue-photo?key='+encodeURIComponent(key):'';
 }catch{return '';}
}
export function canShareEnquiryFile(file,device=navigator){
 if(!file||typeof device?.share!=='function'||typeof device?.canShare!=='function')return false;
 try{return device.canShare({files:[file]})===true;}catch{return false;}
}
export function enquiryItemsFromCart(cart,products){
 return [...cart.values()].map(item=>{
  const found=products.find(p=>p.id===item.productId);
  return {...item,image_path:found?.image_path||''};
 });
}
export function photoSignature(storeName,items){
 return JSON.stringify([storeName,items.map(item=>[item.productId,item.name,item.quantity,item.price,item.unit,item.image_path])]);
}
function fitLines(ctx,text,x,y,width,step,maxLines){
 const words=String(text||'').trim().split(/\s+/);const lines=[];let line='';
 for(const word of words){
  const proposed=line?line+' '+word:word;
  if(ctx.measureText(proposed).width>width&&line){lines.push(line);line=word;}
  else line=proposed;
 }
 if(line)lines.push(line);
 for(let i=0;i<Math.min(maxLines,lines.length);i++){
  let value=lines[i];
  if(i===maxLines-1&&lines.length>maxLines){
   while(value&&ctx.measureText(value+'…').width>width)value=value.slice(0,-1);
   value+='…';
  }
  ctx.fillText(value,x,y+i*step,width);
 }
}
async function imageForEnquiry(raw){
 const path=photoProxyPath(raw);
 if(!path)return null;
 let tmp='';
 try{
  const response=await fetch(path,{cache:'force-cache',signal:AbortSignal.timeout(9500)});
  if(!response.ok)return null;
  const type=(response.headers.get('content-type')||'').split(';')[0];
  if(!['image/jpeg','image/png','image/webp'].includes(type))return null;
  const blob=await response.blob();
  if(blob.size<30||blob.size>5000000)return null;
  tmp=URL.createObjectURL(blob);
  const image=new Image();
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Photo load timeout')),8500);
   image.onload=()=>{clearTimeout(timer);resolve();};
   image.onerror=()=>{clearTimeout(timer);reject(Error('Photo did not load'));};
   image.src=tmp;
  });
  if(!image.naturalWidth||!image.naturalHeight)throw Error('Empty picture');
  return {image,release:()=>URL.revokeObjectURL(tmp)};
 }catch{
  if(tmp)URL.revokeObjectURL(tmp);
  return null;
 }
}
/** Creates a single JPEG attachment with actual product photos and order details.
    For baskets over six lines, the image previews the first six; complete details
    remain in the separate WhatsApp text message. Never uploads data to a new server. */
export async function prepareEnquiryPicture(storeName,items){
 if(!items.length)return null;
 const selected=items.slice(0,6),loaded=await Promise.all(selected.map(p=>imageForEnquiry(p.image_path)));
 const imageCount=loaded.filter(Boolean).length;
 if(!imageCount)return null;
 const rows=Math.ceil(selected.length/2),width=980,height=180+rows*435+96;
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx){for(const part of loaded)part?.release();return null;}
 try{
  ctx.fillStyle='#F2F7F3';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#14562F';ctx.fillRect(0,0,width,180);
  ctx.fillStyle='#CBF2D6';ctx.font='bold 23px Arial,sans-serif';
  ctx.fillText('WHATSAPP PRODUCT ENQUIRY',30,46,930);
  ctx.fillStyle='#FFFFFF';ctx.font='bold 42px Arial,sans-serif';
  fitLines(ctx,storeName,30,108,910,44,1);
  ctx.fillStyle='#DBF5E2';ctx.font='23px Arial,sans-serif';
  ctx.fillText('Photos, quantities and prices',30,152);
  selected.forEach((p,i)=>{
   const col=i%2,row=Math.floor(i/2),x=20+col*485,y=196+row*435,w=455,h=414;
   ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);
   ctx.fillStyle='#F3F8F3';ctx.fillRect(x+13,y+13,w-26,272);
   const loadedPicture=loaded[i];
   if(loadedPicture){
    const im=loadedPicture.image,scale=Math.min((w-42)/im.naturalWidth,248/im.naturalHeight);
    const iw=im.naturalWidth*scale,ih=im.naturalHeight*scale;
    ctx.drawImage(im,x+(w-iw)/2,y+17+(265-ih)/2,iw,ih);
   }else{
    ctx.fillStyle='#718675';ctx.font='21px Arial,sans-serif';
    ctx.fillText('Product photo not available',x+25,y+145,w-50);
   }
   ctx.fillStyle='#233A2A';ctx.font='bold 25px Arial,sans-serif';
   fitLines(ctx,p.name,x+20,y+322,w-40,28,2);
   ctx.fillStyle='#13843B';ctx.font='bold 27px Arial,sans-serif';
   const total=Number(p.quantity)*Number(p.price);
   ctx.fillText(p.quantity+' × '+(p.unit||'piece')+'  ·  ₦'+total.toLocaleString('en-NG'),x+20,y+392,w-40);
  });
  ctx.fillStyle='#244D31';ctx.font='bold 23px Arial,sans-serif';
  const extra=items.length-selected.length;
  ctx.fillText(extra>0?'Plus '+extra+' more product'+(extra>1?'s':'')+' in the enquiry message':'Made with mySales',30,height-45,920);
  const blob=await new Promise((resolve,reject)=>{
   try{canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to create picture')),'image/jpeg',.84);}
   catch(error){reject(error);}
  });
  if(blob.size>12000000)throw Error('Enquiry picture is too large');
  return new File([blob],'mysales-product-enquiry.jpg',{type:'image/jpeg'});
 }finally{
  for(const part of loaded)part?.release();
 }
}
