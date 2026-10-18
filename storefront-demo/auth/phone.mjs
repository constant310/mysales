/* Shared E.164 WhatsApp phone input for merchant account forms. */
export const COUNTRIES=[
 ['+234','Nigeria'],['+233','Ghana'],['+254','Kenya'],['+27','South Africa'],
 ['+237','Cameroon'],['+225',"Côte d'Ivoire"],['+256','Uganda'],['+255','Tanzania'],
 ['+250','Rwanda'],['+251','Ethiopia'],['+232','Sierra Leone'],['+231','Liberia'],
 ['+44','United Kingdom'],['+1','United States / Canada'],['+971','UAE'],
 ['+91','India'],['+86','China']
];
export function fillCountryCodes(select){
 for(const [code,label] of COUNTRIES){
  const option=document.createElement('option');option.value=code;
  option.textContent=label+' ('+code+')';select.append(option);
 }
 const option=document.createElement('option');option.value='other';
 option.textContent='Other country code';select.append(option);select.value='+234';
}
export function showOtherCountryCode(select,field){
 field.hidden=select.value!=='other';
 field.required=select.value==='other';
}
export function internationalWhatsApp(local,selected,other=''){
 const input=String(local||'').trim();
 const code=selected==='other'?String(other||'').trim():String(selected||'').trim();
 if(!/^\+[1-9]\d{0,3}$/.test(code))throw Error('Choose a valid country calling code.');
 if(input.startsWith('+')){
  const full=input.replace(/[\s().-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(full))throw Error('Enter a valid WhatsApp number including country code.');
  return full;
 }
 if(/[^0-9\s().-]/.test(input))throw Error('Enter digits only for your WhatsApp number.');
 let digits=input.replace(/\D/g,'');
 const cc=code.slice(1);
 if(digits.startsWith(cc)&&digits.length>cc.length+7)digits=digits.slice(cc.length);
 if(digits.startsWith('0'))digits=digits.slice(1);
 const full=code+digits;
 if(!/^\+[1-9]\d{7,14}$/.test(full))throw Error('Enter a valid WhatsApp number for this country.');
 return full;
}
export function splitInternationalWhatsApp(value){
 const digits=String(value||'').replace(/\D/g,'');
 const normalized=digits.startsWith('0')?'234'+digits.slice(1):digits;
 const code=COUNTRIES.map(c=>c[0]).sort((a,b)=>b.length-a.length).find(v=>normalized.startsWith(v.slice(1)));
 if(code)return {selected:code,local:normalized.slice(code.length-1),other:''};
 if(!normalized)return {selected:'+234',local:'',other:''};
 const digitsOfCode=Math.min(3,Math.max(1,normalized.length-7));
 return {selected:'other',local:normalized.slice(digitsOfCode),other:'+'+normalized.slice(0,digitsOfCode)};
}
