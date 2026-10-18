/*
 * mySales product photo framing, designed for narrow mobile browsers.
 * A fitted 960px copy is uploaded; the original file on the device is never edited.
 * No remote AI calls, image recognition claims, or new database fields.
 */
export function createPhotoFramer(dialog) {
  if (!dialog) throw Error('Photo editor is missing.');
  const canvas=dialog.querySelector('#framer-canvas');
  const slider=dialog.querySelector('#framer-zoom');
  const save=dialog.querySelector('#framer-save');
  const cancel=dialog.querySelector('#framer-cancel');
  const reset=dialog.querySelector('#framer-fit');
  const hint=dialog.querySelector('#framer-message');
  const context=canvas.getContext('2d');
  if (!context) throw Error('Photo editor is not supported by this browser.');
  const SIDE=960;
  let source=null,sourceUrl='',active=null,offsetX=0,offsetY=0,zoom=100,drag=null;
  canvas.width=SIDE;canvas.height=SIDE;

  function paint() {
    context.fillStyle='#f5f9f5';
    context.fillRect(0,0,SIDE,SIDE);
    if (!source) return;
    const w=source.naturalWidth,h=source.naturalHeight;
    const fit=Math.min((SIDE*.94)/w,(SIDE*.94)/h);
    const drawnWidth=w*fit*zoom/100,drawnHeight=h*fit*zoom/100;
    // Keep the photo reachable when the seller pans at high zoom.
    const maxX=Math.max(0,(drawnWidth-SIDE)/2)+SIDE*.12;
    const maxY=Math.max(0,(drawnHeight-SIDE)/2)+SIDE*.12;
    offsetX=Math.min(maxX,Math.max(-maxX,offsetX));
    offsetY=Math.min(maxY,Math.max(-maxY,offsetY));
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.drawImage(source,(SIDE-drawnWidth)/2+offsetX,(SIDE-drawnHeight)/2+offsetY,drawnWidth,drawnHeight);
    hint.textContent=zoom===100?'Entire original photo is fitted within the card.':'Drag the photo to position your product. Zooming may crop the edges.';
  }
  function releaseImage() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl='';source=null;
  }
  function finish(result) {
    if (!active) return;
    const complete=active;
    active=null;
    if (dialog.open) dialog.close();
    releaseImage();
    complete(result);
  }
  async function open(file) {
    if (!file || !file.type.startsWith('image/')) throw Error('Choose a JPG, PNG or WebP photo.');
    if (file.size>18000000) throw Error('Choose an image smaller than 18 MB.');
    if (active) finish(null);
    releaseImage();
    sourceUrl=URL.createObjectURL(file);
    const image=new Image();
    image.src=sourceUrl;
    try {await image.decode();}
    catch {releaseImage();throw Error('Unable to read this picture. Try another JPG or PNG.');}
    if (!image.naturalWidth || !image.naturalHeight) {releaseImage();throw Error('This picture cannot be opened.');}
    source=image;offsetX=0;offsetY=0;zoom=100;slider.value='100';
    paint();
    dialog.showModal();
    save.disabled=false;
    return new Promise(resolve=>{active=resolve;});
  }
  reset.onclick=()=>{zoom=100;slider.value='100';offsetX=0;offsetY=0;paint();};
  slider.addEventListener('input',()=>{zoom=Number(slider.value);paint();});
  canvas.addEventListener('pointerdown',event=>{
    if (!source) return;
    event.preventDefault();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    const rect=canvas.getBoundingClientRect();
    offsetX+=(event.clientX-drag.x)*SIDE/rect.width;
    offsetY+=(event.clientY-drag.y)*SIDE/rect.height;
    drag.x=event.clientX;drag.y=event.clientY;
    paint();
  });
  const stopDrag=()=>{drag=null;};
  canvas.addEventListener('pointerup',stopDrag);
  canvas.addEventListener('pointercancel',stopDrag);
  cancel.onclick=()=>finish(null);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  dialog.addEventListener('close',()=>{if(active)finish(null);});
  save.onclick=async()=>{
    if(!active || !source)return;
    save.disabled=true;save.textContent='Saving photo…';
    try {
      // Encode the adjusted *copy*. The original image on the phone is unchanged.
      let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
      if(blob?.size>1900000)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.68));
      if(!blob)throw Error('Could not prepare the adjusted photo.');
      finish(new File([blob],'mysales-product-framed.jpg',{type:'image/jpeg'}));
    } catch(error) {
      hint.textContent=error.message;save.disabled=false;
    } finally {save.textContent='Use this photo';}
  };
  return {open};
}
