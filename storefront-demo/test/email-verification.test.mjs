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

test('Supabase Auth remains native while Resend handles the mailer',async()=>{
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

test('Resend SMTP configuration and branded link template are documented',async()=>{
 const guide=await read('docs/email-verification-setup.md');
 const setup=await read('docs/resend-supabase-setup.md');
 const template=await read('docs/auth-verification-email-template.html');
 assert.match(guide,/Resend/);
 assert.match(setup,/no-reply@mysalesofficial.com/);
 assert.match(setup,/smtp.resend.com/);
 assert.match(setup,/resend/);
 assert.match(setup,/465/);
 assert.match(setup,/mysales-v5-email-staging.onrender.com\/login\//);
 assert.match(setup,/Keep the production Render branch unchanged/i);
 assert.match(template,/\{\{ \.ConfirmationURL \}\}/);
 assert.doesNotMatch(template,/\{\{ \.Token \}\}/);
 assert.match(template,/Sign in securely/);
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
test('staging proxy is isolated from the production V5 rollout',async()=>{
 const proxy=await read('render-server.mjs');
 const backend=await read('supabase/functions/early-storefront-backend/index.ts');
 const signup=await read('supabase/functions/early-storefront-signup/index.ts');
 assert.match(proxy,/MYSALES_V5_AUTH_STAGING/);
 assert.match(proxy,/early-storefront-backend-v5-test/);
 assert.match(backend,/early-storefront-backend\(\?:-v5-test\)\?/);
 assert.match(signup,/early-storefront-signup\(\?:-v5-test\)\?/);
 for(const text of [proxy,backend,signup])assert.match(text,/mysales-v5-email-staging.onrender.com/);
});
