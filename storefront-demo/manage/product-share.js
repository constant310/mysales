// Pure vendor-facing product share card renderer. No private manager token or
// customer identifiers are included in exported images or messages.
export const maxShareProducts=6;
const currency=amount=>Number.isFinite(Number(amount))?'₦'+Number(amount).toLocaleString('en-NG'):'Ask for price';
export function productShareText({storeName,products,storeUrl,note=''}) {
 const rows=products.map((p,index)=>{
  const unit=p.units?.[0];
  const price=unit?currency(unit.price)+(unit.name&&unit.name!=='piece'?' / '+unit.name:''):'Ask for price';
  return (index+1)+'. '+p.name+' — '+price;
 });
 return [storeName+' · Product details','',...rows,
   note.trim()?'':'',note.trim(),
   '',storeUrl?'Browse more: '+storeUrl:'','Reply here to ask about availability.']
   .filter((line,index,all)=>line!==''||all[index-1]!=='')
   .join('\n').trim();
}
const waitForImage=(url,timeout=8000)=>new Promise(resolve=>{
 if(!/^https:\/\//i.test(url||''))return resolve(null);
 const img=new Image();let settled=false;
 const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(value);};
 const timer=setTimeout(()=>finish(null),timeout);
 img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';
 img.onload=()=>finish(img.naturalWidth&&img.naturalHeight?img:null);
 img.onerror=()=>finish(null);
 img.src=url;
});
function roundRect(ctx,x,y,w,h,r){
 ctx.beginPath();ctx.roundRect(x,y,w,h,r);
}
function drawLimitedText(ctx,text,x,y,maxWidth,maxLines,lineHeight){
 const words=String(text||'').split(/\s+/).filter(Boolean);
 const lines=[];let line='';
 for(const word of words){
  const attempt=line?line+' '+word:word;
  if(line&&ctx.measureText(attempt).width>maxWidth){lines.push(line);line=word;}
  else line=attempt;
 }
 if(line)lines.push(line);
 for(let i=0;i<Math.min(lines.length,maxLines);i++){
  let content=lines[i];
  if(i===maxLines-1&&i<lines.length-1){
   while(ctx.measureText(content+'…').width>maxWidth&&content.length)content=content.slice(0,-1);
   content+='…';
  }
  ctx.fillText(content,x,y+i*lineHeight,maxWidth);
 }
}
function drawImageInside(ctx,img,x,y,w,h){
 const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
 const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
 ctx.drawImage(img,x+(w-width)/2,y+(h-height)/2,width,height);
}
export async function createProductShareCard({storeName,products,storeUrl}) {
 if(!Array.isArray(products)||products.length<1||products.length>maxShareProducts)throw Error('Select 1 to 6 products.');
 const columns=products.length===1?1:2;
 const w=1000,pad=46,gap=20,tileW=(w-pad*2-gap*(columns-1))/columns;
 const tileH=columns===1?650:406;
 const rows=Math.ceil(products.length/columns),heading=182,footer=104;
 const height=heading+rows*tileH+Math.max(0,rows-1)*gap+footer;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw Error('Your browser cannot create images. Use Copy details instead.');
 ctx.fillStyle='#f4f9f5';ctx.fillRect(0,0,w,height);
 ctx.fillStyle='#143d28';ctx.fillRect(0,0,w,heading);
 ctx.fillStyle='#b4edc6';ctx.font='800 22px system-ui,sans-serif';ctx.fillText('MYSALES · PRODUCT SELECTION',pad,49);
 ctx.fillStyle='white';ctx.font='800 50px system-ui,sans-serif';
 drawLimitedText(ctx,storeName,pad,100,w-pad*2,1,52);
 ctx.fillStyle='#d0f0d8';ctx.font='500 23px system-ui,sans-serif';ctx.fillText('Products, pictures and prices · Ask us on WhatsApp',pad,150);
 let photoCount=0;
 const images=await Promise.all(products.map(product=>waitForImage(product.image_path)));
 products.forEach((p,i)=>{
  const x=pad+(i%columns)*(tileW+gap),y=heading+Math.floor(i/columns)*(tileH+gap);
  roundRect(ctx,x,y,tileW,tileH,20);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#dfeae1';ctx.lineWidth=2;ctx.stroke();
  const imPad=13,photoH=columns===1?455:275;
  roundRect(ctx,x+imPad,y+imPad,tileW-imPad*2,photoH,14);
  ctx.fillStyle='#f1f6f1';ctx.fill();ctx.save();ctx.clip();
  if(images[i]){
   try{drawImageInside(ctx,images[i],x+imPad,y+imPad,tileW-imPad*2,photoH);photoCount++;}
   catch{ /* Missing/broken image displays the explicit placeholder below. */ }
  }
  if(!images[i]){
   ctx.fillStyle='#96ad9b';ctx.font='700 20px system-ui,sans-serif';
   ctx.textAlign='center';ctx.fillText('Photo unavailable',x+tileW/2,y+imPad+photoH/2);
   ctx.textAlign='left';
  }
  ctx.restore();
  const tx=x+23,ty=y+imPad+photoH+40;
  ctx.fillStyle='#263b2e';ctx.font=(columns===1?'800 39':'800 29')+'px system-ui,sans-serif';
  drawLimitedText(ctx,p.name,tx,ty,tileW-46,2,columns===1?44:34);
  ctx.fillStyle='#127c3d';ctx.font=(columns===1?'900 43':'900 32')+'px system-ui,sans-serif';
  const unit=p.units?.[0];const price=unit?currency(unit.price):'Ask for price';
  ctx.fillText(price,tx,y+tileH-23,tileW-46);
 });
 ctx.fillStyle='#547060';ctx.font='700 23px system-ui,sans-serif';
 const footerY=height-footer+44;
 ctx.fillText('See more products',pad,footerY);
 ctx.fillStyle='#16823d';ctx.font='650 22px system-ui,sans-serif';
 drawLimitedText(ctx,storeUrl||'',pad,footerY+35,w-pad*2,1,25);
 const blob=await new Promise((resolve,reject)=>{
  canvas.toBlob(result=>result?resolve(result):reject(new Error('Could not generate the product picture.')),'image/jpeg',.9);
 });
 const fileName='mysales-'+(storeName||'shop').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,34)+'-products.jpg';
 return {file:new File([blob],fileName,{type:'image/jpeg'}),photosIncluded:photoCount,photosRequested:products.filter(p=>p.image_path).length};
}
