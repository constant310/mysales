import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');

test('login includes email verification, code entry, resend and recovery UX',async()=>{
 const login=await read('login/index.html');
 for(const name of ['email-form','verify-form','code','resend','change','status'])
  assert.match(login,new RegExp('id="'+name+'"'));
 assert.match(login,/inputmode="numeric"/);
 assert.match(login,/pattern="\[0-9\]\{6\}"/);
 assert.match(login,/secondsUntilResend/);
 assert.match(login,/consumeEmailLink/);
 assert.match(login,/ownerDestination/);
 assert.doesNotMatch(login,/type="password"/);
});

test('auth API strictly validates OTP before storing session',async()=>{
 const source=await read('auth/client.mjs');
 assert.match(source,/authRequest\('otp\?redirect_to='/);
 assert.match(source,/authRequest\('verify',\{email:normalized,token:input,type:'email'\}\)/);
 assert.match(source,/\/\^\\d\{6\}\$\/\.test\(input\)/);
 assert.match(source,/saveSession\(session\)/);
 assert.match(source,/token_hash/);
 assert.match(source,/access_token/);
 assert.match(source,/refresh_token/);
 assert.match(source,/auth\/v1\//);
 assert.match(source,/OTP_COOLDOWN_MS=60000/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('email template contains one-time OTP and redirect-capable magic link',async()=>{
 const template=await read('docs/auth-verification-email-template.html');
 assert.match(template,/\{\{ \.Token \}\}/);
 assert.match(template,/\{\{ \.ConfirmationURL \}\}/);
 assert.match(template,/Never share your verification code/);
 assert.doesNotMatch(template,/href="http:/);
});

test('configuration guide includes both public origins and template setup',async()=>{
 const guide=await read('docs/email-verification-setup.md');
 assert.match(guide,/Authentication.*Email Templates/);
 assert.match(guide,/store\.mysalesofficial\.com\/login\//);
 assert.match(guide,/mysales-early-storefront-branch\.onrender\.com\/login\//);
 assert.match(guide,/SMTP/);
 assert.match(guide,/two controlled test inboxes/);
});