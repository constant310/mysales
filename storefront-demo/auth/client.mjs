/* mySales Storefront: password and Google OAuth identity through Supabase Auth.
   This is an intentionally public publishable key, NOT a service-role secret.
   Seller requests are independently authorized by the Edge backend. */
const API='https://wsxszbdvvtowmrnxdsrp.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_JdUSYUZwX9RNdchmtUUEfw_ralc2WyT';
const SESSION_KEY='mysales_storefront_account_v1';
const PENDING_KEY='mysales_storefront_pending_email_v1';
const LINK_COOLDOWN_MS=60000;
const commonHeaders={'apikey':PUBLISHABLE_KEY,'Content-Type':'application/json'};

function getJson(storage,key){
 try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}
}
function clearPending(){
 try{sessionStorage.removeItem(PENDING_KEY);}catch{}
}
function pending(){
 try{return getJson(sessionStorage,PENDING_KEY);}catch{return null;}
}
function normalizeEmail(value){
 const email=String(value||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw Error('Enter a valid email address.');
 return email;
}
function currentSession(){return getJson(localStorage,SESSION_KEY);}
function saveSession(value){
 if(!value||typeof value.access_token!=='string'||typeof value.refresh_token!=='string')
  throw Error('Verification did not return a valid session. Request a new sign-in link.');
 const life=Number(value.expires_in||3600);
 if(!Number.isFinite(life)||life<=0)throw Error('Invalid session duration.');
 localStorage.setItem(SESSION_KEY,JSON.stringify({
  access_token:value.access_token,refresh_token:value.refresh_token,
  expires_at:Math.floor(Date.now()/1000)+life
 }));
 clearPending();
}
async function authRequest(path,body,accessToken=''){
 const headers={...commonHeaders};
 if(accessToken)headers.Authorization='Bearer '+accessToken;
 let response;
 try{response=await fetch(API+'/auth/v1/'+path,{
  method:'POST',headers,body:JSON.stringify(body),cache:'no-store'
 });}catch{throw Error('Could not connect. Check your internet connection and try again.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const serverMessage=String(data.msg||data.error_description||data.message||'').slice(0,200);
  if(response.status===429)throw Error('Too many attempts. Please wait before trying again.');
  if(response.status===422)throw Error(serverMessage||'Your sign-in link is invalid or has expired.');
  throw Error(serverMessage||'Authentication failed. Please try again.');
 }
 return data;
}
export function pendingEmail(){
 return normalizePendingEmail(pending()?.email);
}
function normalizePendingEmail(email){
 try{return normalizeEmail(email);}catch{return '';}
}
export function secondsUntilResend(email){
 const p=pending();
 if(!p||p.email!==normalizePendingEmail(email))return 0;
 return Math.max(0,Math.ceil((Number(p.nextSendAt||0)-Date.now())/1000));
}
export function signedIn(){return Boolean(currentSession()?.access_token);}

export async function requestSignInLink(email){
 const normalized=normalizeEmail(email);
 const remaining=secondsUntilResend(normalized);
 if(remaining>0)throw Error('Please wait '+remaining+' seconds before requesting another sign-in link.');
 await authRequest('otp?redirect_to='+encodeURIComponent(location.origin+'/login/'),{
  email:normalized,create_user:true
 });
 try{sessionStorage.setItem(PENDING_KEY,JSON.stringify({
  email:normalized,nextSendAt:Date.now()+LINK_COOLDOWN_MS
 }));}catch{}
 return normalized;
}

const PASSWORD_MIN_LENGTH=8;
function checkPassword(password){
 if(typeof password!=='string'||password.length<PASSWORD_MIN_LENGTH||password.length>128)
  throw Error('Use a password between 8 and 128 characters.');
 return password;
}
/** Sign in using native Supabase Auth email/password. Never retain a password in storage. */
export async function signInWithPassword(email,password){
 const result=await authRequest('token?grant_type=password',{
  email:normalizeEmail(email),password:checkPassword(password)
 });
 saveSession(result);
 return result;
}
/** Password signups require "Confirm email" OFF in the Supabase Email provider.
    If the project still requires verification, do not treat the account as signed in. */
export async function signUpWithPassword(email,password){
 const result=await authRequest('signup',{
  email:normalizeEmail(email),password:checkPassword(password)
 });
 if(!result?.session?.access_token||!result?.session?.refresh_token)
  throw Error('Account created but email confirmation is still required. Ask the administrator to disable Confirm email in Supabase Auth before using password signup.');
 saveSession(result.session);
 return result.session;
}
/** Supabase Auth hosts the Google OAuth dance and checks Google's signed identity.
    Google client ID/secret belong only in the Supabase dashboard, never in this code. */
export function beginGoogleSignIn(){
 const redirect=location.origin+'/login/';
 const endpoint=API+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(redirect);
 location.assign(endpoint);
}

export async function consumeEmailLink(){
 const fragment=new URLSearchParams(location.hash.slice(1));
 const query=new URLSearchParams(location.search);
 const errorDescription=fragment.get('error_description')||query.get('error_description')||'';
 if(fragment.has('error')||query.has('error')){
  // Remove transient provider details from browser history before displaying the error.
  history.replaceState(null,'',location.pathname);
  // Supabase sometimes double-encodes provider errors (for example %3A and %2F).
  // Do not show confusing OAuth internals or temporary codes to merchants.
  let decoded=errorDescription;
  try{decoded=decodeURIComponent(decoded);}catch{}
  if(/Unable to exchange external code/i.test(decoded))
   throw Error('Google sign-in is temporarily unavailable. The Google OAuth client credentials in Supabase need to be corrected. Please contact mySales support.');
  if(/access_denied|cancelled|canceled/i.test(decoded))
   throw Error('Google sign-in was cancelled. Please try again.');
  throw Error('Google sign-in could not be completed. Please try again or contact mySales support.');
 }
 if(fragment.has('access_token')||fragment.has('refresh_token')){
  if(!fragment.has('access_token')||!fragment.has('refresh_token'))
   throw Error('Incomplete sign-in link. Try signing in again.');
  saveSession({
   access_token:fragment.get('access_token'),
   refresh_token:fragment.get('refresh_token'),
   expires_in:Number(fragment.get('expires_in')||3600)
  });
  history.replaceState(null,'',location.pathname);
  return true;
 }
 if(query.has('token_hash')){
  const type=query.get('type');
  if(!['email','signup','magiclink'].includes(type))
   throw Error('Unrecognized verification link. Request a new sign-in link.');
  const token_hash=query.get('token_hash');
  if(!token_hash||token_hash.length>4096)throw Error('Invalid verification link.');
  const session=await authRequest('verify',{token_hash,type});
  saveSession(session);
  history.replaceState(null,'',location.pathname);
  return true;
 }
 return false;
}
export async function accessToken(){
 const session=currentSession();
 if(!session?.access_token||!session?.refresh_token)return '';
 if(session.expires_at*1000>Date.now()+90000)return session.access_token;
 try{
  const renewed=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
  saveSession(renewed);
  return renewed.access_token;
 }catch{
  try{localStorage.removeItem(SESSION_KEY);}catch{}
  return '';
 }
}
export async function requireAccount(){
 const token=await accessToken();
 if(!token){
  location.replace('/login/?next='+encodeURIComponent(location.pathname));
  throw Error('Please sign in first.');
 }
 return token;
}
export async function logout(){
 const token=await accessToken();
 try{localStorage.removeItem(SESSION_KEY);}catch{}
 if(token)try{
  await fetch(API+'/auth/v1/logout',{method:'POST',cache:'no-store',headers:{...commonHeaders,Authorization:'Bearer '+token}});
 }catch{}
 location.replace('/login/');
}
export async function ownerDestination(){
 const token=await accessToken();
 if(!token)return '/login/';
 let result;
 try{
  result=await fetch('/api/merchant/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 }catch{throw Error('Could not connect to your store. Check your internet connection.');}
 if(result.ok)return '/manage/';
 if(result.status===404)return '/create/';
 if(result.status===401){
  try{localStorage.removeItem(SESSION_KEY);}catch{}
  return '/login/';
 }
 if(result.status===403)throw Error('Store access is restricted. Contact mySales support.');
 throw Error('Could not check your store right now. Please try again.');
}
