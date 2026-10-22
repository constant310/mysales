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
export const MAX_ENQUIRY_IMAGES=5;

// Canonical shop addresses are always generated from a vetted public handle.
export function merchantStoreUrl(store) {
 const handle=String(store?.public_handle||store?.slug||'').trim().toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))return '';
 return 'https://store.mysalesofficial.com/'+encodeURIComponent(handle);
}
export function whatsappSellerLink(rawNumber,message) {
 const phone=String(rawNumber||'').replace(/\D/g,'');
 if(!/^[1-9]\d{7,14}$/.test(phone))return '';
 return 'https://wa.me/'+phone+'?text='+encodeURIComponent(String(message||''));
}
export function withStoreLink(message,shopUrl) {
 const text=String(message||'').trim();
 const link=String(shopUrl||'').trim();
 return link&&!text.includes(link)?text+'\n\nShop: '+link:text;
}
export function canShareEnquiryFiles(files,device=typeof navigator==='undefined'?null:navigator){
 if(!Array.isArray(files)||!files.length||typeof device?.share!=='function'||typeof device?.canShare!=='function')return false;
 try{return device.canShare({files})===true;}catch{return false;}
}
// Backwards-compatible helper for existing one-product checks.
export function canShareEnquiryFile(file,device=typeof navigator==='undefined'?null:navigator){
 return canShareEnquiryFiles(file?[file]:[],device);
}
export function enquiryItemsFromCart(cart,products){
 return [...cart.values()].map(item=>{
  const found=products.find(p=>p.id===item.productId);
  return {...item,image_path:found?.image_path||''};
 });
}
export function photoSignature(storeName,items,shopUrl=''){
 return JSON.stringify([storeName,shopUrl,items.map(item=>[item.productId,item.name,item.quantity,item.price,item.unit,item.image_path])]);
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
/** Portrait-oriented layout; centre a single card or an incomplete last row. */
export function enquiryPortraitLayout(count,variant='enquiry'){
 const total=Math.max(1,Math.min(MAX_ENQUIRY_IMAGES,Math.floor(Number(count)||1)));
 const width=1080,header=230,footer=125,gap=24,side=44,rows=Math.ceil(total/2);
 const single=total===1,cardHeight=single?900:575;
 const cardWidth=single?820:(width-2*side-gap)/2;
 const gridHeight=rows*cardHeight+(rows-1)*gap;
 const height=variant==='status'?1920:Math.max(1440,header+gridHeight+footer+110);
 const startY=Math.round(header+(height-header-footer-gridHeight)/2);
 const cards=Array.from({length:total},(_,index)=>{
  const row=Math.floor(index/2),col=index%2;
  const lone=single||(total%2===1&&index===total-1);
  const x=lone?Math.round((width-cardWidth)/2):side+col*(cardWidth+gap);
  return variant==='status'?{x:36,y:302,w:1008,h:1385,single:true}:{x,y:startY+row*(cardHeight+gap),w:cardWidth,h:cardHeight,single};
 });
 return {width,height,header:variant==='status'?290:header,footer:variant==='status'?210:footer,cards};
}

/** Builds one portrait JPEG for exactly one selected product.
     This never combines multiple product photos into a collage. */
export async function prepareEnquiryPicture(storeName,items,{variant='enquiry',shopUrl='',showPrice=true}={}){
 if(items.length!==1)return null;
 const selected=items.slice(0,MAX_ENQUIRY_IMAGES),loaded=await Promise.all(selected.map(p=>imageForEnquiry(p.image_path)));
 const imageCount=loaded.filter(Boolean).length;
 if(!imageCount)return null;
 const isStatus=variant==='status';
 const layout=enquiryPortraitLayout(selected.length,variant);
 const {width,height}=layout;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx){for(const part of loaded)part?.release();return null;}
 try{
  ctx.fillStyle='#F2F7F3';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#14562F';ctx.fillRect(0,0,width,layout.header);
  ctx.fillStyle='#CBF2D6';ctx.font='bold 25px Arial,sans-serif';
  ctx.fillText(isStatus?'AVAILABLE IN OUR STORE':'WHATSAPP PRODUCT ENQUIRY',45,isStatus?90:56,990);
  ctx.fillStyle='#FFFFFF';ctx.font='bold 55px Arial,sans-serif';
  fitLines(ctx,storeName,45,isStatus?164:133,990,57,1);
  ctx.fillStyle='#DBF5E2';ctx.font='26px Arial,sans-serif';
  ctx.fillText(isStatus?'Discover something you will love':'Photos, quantities and prices',45,isStatus?235:187);
  selected.forEach((p,i)=>{
   const {x,y,w,h,single}=layout.cards[i];
   const mediaHeight=isStatus?1082:(single?610:350);
   const mediaX=x+17,mediaY=y+17,mediaW=w-34;
   ctx.fillStyle='#FFFFFF';ctx.fillRect(x,y,w,h);
   ctx.fillStyle='#F3F8F3';ctx.fillRect(mediaX,mediaY,mediaW,mediaHeight);
   const picture=loaded[i];
   if(picture){
    const im=picture.image,scale=Math.min((mediaW-60)/im.naturalWidth,(mediaHeight-54)/im.naturalHeight);
    const iw=im.naturalWidth*scale,ih=im.naturalHeight*scale;
    ctx.drawImage(im,x+(w-iw)/2,mediaY+(mediaHeight-ih)/2,iw,ih);
   }else{
    ctx.fillStyle='#718675';ctx.font=single?'bold 27px Arial,sans-serif':'21px Arial,sans-serif';
    ctx.textAlign='center';
    ctx.fillText('Product photo not available',x+w/2,mediaY+mediaHeight/2,w-54);
    ctx.textAlign='left';
   }
   ctx.fillStyle='#233A2A';ctx.font=isStatus?'bold 46px Arial,sans-serif':(single?'bold 42px Arial,sans-serif':'bold 29px Arial,sans-serif');
   fitLines(ctx,p.name,x+24,mediaY+mediaHeight+(single?72:61),w-48,single?49:35,2);
   ctx.fillStyle='#13843B';ctx.font=isStatus?'bold 46px Arial,sans-serif':(single?'bold 39px Arial,sans-serif':'bold 28px Arial,sans-serif');
   const total=Number(p.quantity)*Number(p.price);
   if(!isStatus||showPrice)ctx.fillText(isStatus?'₦'+Number(p.price).toLocaleString('en-NG'):p.quantity+' × '+(p.unit||'piece')+'  ·  ₦'+total.toLocaleString('en-NG'),x+24,y+h-45,w-48);
  });
  if(isStatus){
   // mySales logo matches the existing mS brand mark in the dashboard.
   const footY=height-210;
   ctx.fillStyle='#14562F';ctx.fillRect(0,footY,width,210);
   const site=String(shopUrl||'').replace(/^https?:\/\//,'').slice(0,110);
   if(site){
    ctx.fillStyle='#DBF5E2';ctx.font='bold 28px Arial,sans-serif';
    ctx.textAlign='center';ctx.fillText('Shop here: '+site,width/2,footY+46,width-64);
    ctx.textAlign='left';
   }
   const logoX=365,logoY=footY+92;
   ctx.fillStyle='#16A34A';ctx.fillRect(logoX,logoY,94,94);
   ctx.fillStyle='#FFFFFF';ctx.textAlign='center';
   ctx.font='bold 53px Arial,sans-serif';ctx.fillText('mS',logoX+47,logoY+65,90);
   ctx.textAlign='left';ctx.font='bold 54px Arial,sans-serif';
   ctx.fillText('mySales',logoX+114,logoY+66,510);
  }else{
   // Visible link on every forwarded product image (image text is not tappable).
   ctx.fillStyle='#E3F2E7';ctx.fillRect(0,height-125,width,125);
   const visibleUrl=String(shopUrl||'').replace(/^https?:\/\//,'');
   if(visibleUrl){
    ctx.fillStyle='#0B5E36';ctx.font='bold 22px Arial,sans-serif';
    ctx.fillText('SHOP:',32,height-86);
    ctx.fillStyle='#154D32';ctx.font='bold 28px Arial,sans-serif';
    ctx.fillText(visibleUrl,32,height-46,width-64);
   }
   ctx.fillStyle='#276646';ctx.font='bold 20px Arial,sans-serif';
   ctx.fillText('Powered by mySales',32,height-16,width-64);
  }
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


/** Creates separate, portrait JPEG files for multiple products.
 * Missing/unavailable product photos are omitted from attachments, not replaced
 * with random stock images. The WhatsApp text continues to describe all items.
 * Process sequentially to avoid many large canvases in memory at once.
 */
export async function prepareEnquiryPictures(storeName,items,shopUrl=''){
 const result=[],seen=new Set();
 if(!Array.isArray(items)||!items.length)return result;
 for(const item of items){
  if(result.length>=MAX_ENQUIRY_IMAGES)break;
  try{
   if(!photoProxyPath(item.image_path)||seen.has(item.image_path))continue;
   seen.add(item.image_path);
   const file=await prepareEnquiryPicture(storeName,[item],{shopUrl});
   if(!file)continue;
   const safeName=String(item.name||'product').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36)||'product';
   const name='mysales-'+String(result.length+1).padStart(2,'0')+'-'+safeName+'.jpg';
   result.push(new File([file],name,{type:'image/jpeg'}));
  }catch{
   // Failed photos do not prevent sending the full text enquiry.
  }
 }
 return result;
}

/** Each WhatsApp Status file is a standalone 9:16 picture that never displays
 * inventory quantities. Customer enquiry files retain their quantities.
 */
export async function prepareStatusPictures(storeName,products,shopUrl='',options={}){
 const showPrice=options?.showPrice!==false;
 const files=[];
 for(const [index,product] of (Array.isArray(products)?products:[]).slice(0,MAX_ENQUIRY_IMAGES).entries()){
  if(!photoProxyPath(product.image_path))continue;
  const unit=product.units?.[0];
  if(!unit||!Number.isFinite(Number(unit.price)))continue;
  try{
   const file=await prepareEnquiryPicture(storeName,[{
    productId:product.id,name:product.name,image_path:product.image_path,
    price:Number(unit.price),unit:unit.name||'piece',quantity:1
   }],{variant:'status',shopUrl,showPrice});
   if(!file)continue;
   const safeName=String(product.name||'product').toLowerCase().replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'').slice(0,32)||'product';
   files.push(new File([file],'mysales-status-'+String(index+1).padStart(2,'0')+'-'+safeName+'.jpg',{type:'image/jpeg'}));
  }catch{}
 }
 return files;
}
