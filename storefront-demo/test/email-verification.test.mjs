import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');

test('default Supabase sign-in link replaces code-based verification UI',async()=>{
 const login=await read('login/index.html');
 for(const name of ['email-form','link-panel','resend','change','status'])
  assert.match(login,new RegExp('id="'+name+'"'));
 assert.match(login,/Send sign-in link/);
 assert.match(login,/Tap the one-time sign-in link/);
 assert.match(login,/requestSignInLink/);
 assert.match(login,/secondsUntilResend/);
 assert.match(login,/consumeEmailLink/);
 assert.match(login,/ownerDestination/);
 assert.doesNotMatch(login,/id="code"|id="verify-form"|type="password"/);
});

test('default Supabase Auth is used without requiring a custom email template or SMTP',async()=>{
 const source=await read('auth/client.mjs');
 assert.match(source,/export async function requestSignInLink/);
 assert.match(source,/authRequest\('otp\?redirect_to='/);
 assert.match(source,/create_user:true/);
 assert.match(source,/token_hash/);
 assert.match(source,/access_token/);
 assert.match(source,/refresh_token/);
 assert.match(source,/auth\/v1\//);
 assert.match(source,/LINK_COOLDOWN_MS=60000/);
 assert.doesNotMatch(source,/export async function verifyCode/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('default email restrictions and URL configuration are clearly documented',async()=>{
 const guide=await read('docs/email-verification-setup.md');
 assert.match(guide,/Default Supabase Auth/);
 assert.match(guide,/team member/);
 assert.match(guide,/store\.mysalesofficial\.com\/login\//);
 assert.match(guide,/mysales-early-storefront-branch\.onrender\.com\/login\//);
 assert.match(guide,/default email templates/);
 assert.match(guide,/production/);
});

test('verified sellers without stores are distinct from invalid or unverified sessions',async()=>{
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