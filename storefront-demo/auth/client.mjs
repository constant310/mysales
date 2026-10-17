/* mySales Early Storefront: browser-side Supabase email OTP identity.
   The publishable key is public; never place service-role keys here.
   The backend checks this JWT AND the store owner mapping for every action. */
const ORIGIN='https://wsxszbdvvtowmrnxdsrp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_JdUSYUZwX9RNdchmtUUEfw_ralc2WyT';
const STORE='mysales_storefront_account_v1';
const headers={'apikey':PUBLISHABLE_KEY,'Content-Type':'application/json'};
export const signedIn=()=>Boolean(read()?.access_token);
function read(){try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch{return null;}}
function store(value){if(!value?.access_token||!value?.refresh_token)throw Error('Login response incomplete');const expires_at=Math.floor(Date.now()/1000)+Number(value.expires_in||3600);localStorage.setItem(STORE,JSON.stringify({...value,expires_at}));}
async function request(path,body,access_token){
 const h={...headers};
 if(access_token)h.Authorization='Bearer '+access_token;
 const response=await fetch(ORIGIN+'/auth/v1/'+path,{method:'POST',headers:h,body:JSON.stringify(body),cache:'no-store'});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.msg||value.error_description||value.message||'Could not sign in. Try again.');
 return value;
}
export async function requestCode(email){
 const value=String(email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>254)throw Error('Enter a valid email address.');
 return request('otp?redirect_to='+encodeURIComponent(location.origin+'/login/'),{email:value,create_user:true});
}
export async function verifyCode(email,code){
 const value=await request('verify',{email:String(email).trim().toLowerCase(),token:String(code).trim(),type:'email'});
 store(value);return value;
}
export async function consumeEmailLink(){
 const fragment=new URLSearchParams(location.hash.slice(1));
 const query=new URLSearchParams(location.search);
 if(fragment.has('access_token')&&fragment.has('refresh_token')){
  store({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token'),expires_in:Number(fragment.get('expires_in')||3600)});
  history.replaceState({},'',location.pathname);return true;
 }
 if(query.has('token_hash')&&query.has('type')){
  const type=query.get('type');
  if(!['magiclink','email','signup','recovery'].includes(type))throw Error('Unrecognized email link');
  const value=await request('verify',{token_hash:query.get('token_hash'),type});
  store(value);history.replaceState({},'',location.pathname);return true;
 }
 return false;
}
export async function accessToken(){
 const value=read();if(!value?.access_token)return '';
 if((value.expires_at||0)*1000>Date.now()+90000)return value.access_token;
 if(!value.refresh_token)return '';
 try{
  const renewed=await request('token?grant_type=refresh_token',{refresh_token:value.refresh_token});
  store(renewed);return renewed.access_token;
 }catch{localStorage.removeItem(STORE);return '';}
}
export async function requireAccount(){
 const token=await accessToken();
 if(!token){location.replace('/login/?next='+encodeURIComponent(location.pathname));throw Error('Please sign in first.');}
 return token;
}
export async function logout(){
 const token=await accessToken();
 localStorage.removeItem(STORE);
 if(token)try{await fetch(ORIGIN+'/auth/v1/logout',{method:'POST',headers:{...headers,Authorization:'Bearer '+token},cache:'no-store'});}catch{}
 location.replace('/login/');
}
export async function ownerDestination(){
 const token=await accessToken();if(!token)return '/login/';
 const response=await fetch('/api/merchant/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 if(response.ok)return '/manage/';
 if(response.status===401||response.status===404)return '/create/';
 throw Error('Could not check your store right now. Please try again.');
}
