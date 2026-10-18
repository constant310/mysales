import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');

test('Google and password authentication are visible without OTP requirement',async()=>{
 const login=await read('login/index.html');
 for(const part of ['id="google"','id="password-form"','id="tab-signin"','id="tab-signup"',
  'id="email"','id="password"','id="confirm-password"','Sign in','Create my account',
  'Continue with Google','signInWithPassword','signUpWithPassword','beginGoogleSignIn',
  'consumeEmailLink','ownerDestination'])
   assert.ok(login.includes(part),part);
 assert.doesNotMatch(login,/id="code"|id="verify-form"|id="resend"|requestSignInLink/);
 assert.match(login,/autocomplete="current-password"/);
 assert.match(login,/maxlength="128"/);
});

test('Supabase password registration fails closed until email confirmation is disabled',async()=>{
 const client=await read('auth/client.mjs');
 assert.match(client,/export async function signInWithPassword/);
 assert.match(client,/export async function signUpWithPassword/);
 assert.match(client,/authRequest\('signup'/);
 assert.match(client,/authRequest\('token\?grant_type=password'/);
 assert.match(client,/result\.session/);
 assert.match(client,/saveSession\(result\.session\)/);
 assert.match(client,/email confirmation is still required/);
 assert.match(client,/PASSWORD_MIN_LENGTH=8/);
 assert.doesNotMatch(client,/localStorage\.setItem\([^)]*password/);
 assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('Google OAuth uses Supabase authorize endpoint and fixed origin callback',async()=>{
 const client=await read('auth/client.mjs');
 assert.match(client,/provider=google&redirect_to=/);
 assert.match(client,/location\.origin\+'\/login\/'/);
 assert.match(client,/location\.assign\(endpoint\)/);
 assert.match(client,/fragment\.has\('access_token'\)/);
 assert.match(client,/history\.replaceState\(null,''\,location\.pathname\)/);
});

test('existing protected owner endpoints are unchanged',async()=>{
 const edge=await read('supabase/functions/early-storefront-backend/index.ts');
 const client=await read('auth/client.mjs');
 const create=await read('create/index.html');
 const manage=await read('manage/index.html');
 assert.match(edge,/email_confirmed_at/);
 assert.match(edge,/if\(!verified\)return out\(401/);
 assert.match(edge,/return out\(404,\{authenticated:true,hasStore:false\}\)/);
 assert.match(client,/if\(result.status===404\)return '\/create\/'/);
 assert.match(client,/if\(result.status===401\)/);
 assert.match(create,/if\(response.status===401\)return location.replace\('\/login\/'\)/);
 assert.match(create,/if\(response.status!==404\)/);
 assert.match(manage,/if\(error.status===401\)location.replace\('\/login\/'\)/);
});

test('setup guide covers full Google configuration and password risks',async()=>{
 const guide=await read('docs/email-verification-setup.md');
 assert.match(guide,/Confirm email OFF/);
 assert.match(guide,/Google OAuth/);
 assert.match(guide,/wsxszbdvvtowmrnxdsrp.supabase.co\/auth\/v1\/callback/);
 assert.match(guide,/console.cloud.google.com/);
 assert.match(guide,/pre-account-takeover/);
 assert.match(guide,/mysales-v5-email-staging.onrender.com\/login\//);
});

test('staging proxy isolates V5 backend from production',async()=>{
 const proxy=await read('render-server.mjs');
 assert.match(proxy,/MYSALES_V5_AUTH_STAGING/);
 assert.match(proxy,/early-storefront-backend-v5-test/);
});

test('OAuth error responses are scrubbed and double-encoded provider errors are user-friendly',async()=>{
 const source=await read('auth/client.mjs');
 assert.match(source,/decodeURIComponent\(decoded\)/);
 assert.match(source,/Unable to exchange external code/);
 assert.match(source,/Google OAuth client credentials in Supabase need to be corrected/);
 assert.match(source,/history\.replaceState\(null,''\,location\.pathname\)/);
 assert.doesNotMatch(source,/throw Error\(errorDescription\|\|/);
});
