# mySales V5 — Google + email/password authentication

Current implementation: **Google Sign-In plus email/password**, with **no mandatory email verification for password accounts** once Supabase's "Confirm email" toggle has been disabled.

## Routes and behavior
- /login/ has two tabs for email/password sign in or new registration, and one Google Sign-In button.
- Authentication uses Supabase Auth native endpoints; passwords never enter Render or the Edge Function and are never saved to localStorage.
- Google redirects to Supabase Auth OAuth; Supabase sends browser session tokens to the same /login/ callback, where URL fragments are cleared after capture.
- Registered seller with an owned store opens /manage/; new seller goes to /create/.
- Public buyers still browse products and send WhatsApp enquiries without authenticating.
- Existing legacy private manager links are handled only through one-time store migration.

## Required dashboard setup

Supabase project: wsxszbdvvtowmrnxdsrp (shared "Exam Bank" project).
**Important:** Supabase Auth settings affect all apps using this project, not just mySales.

### 1. Email and password without confirmation

In Supabase Dashboard → Authentication → Providers → Email:
- Turn on **Email** (you previously confirmed this).
- Turn **Confirm email OFF**, then Save. Password signup returns a session only after this setting is disabled.
- Leave password authentication enabled and "Allow new users to sign up" enabled.
- Configure recommended password strength and rate limits in Authentication Security and Rate Limits.
- Do not enable sign-up confirmation-email sending if you want zero email requirement.

**Security trade-off:** Disabling confirmation implicitly marks self-declared email addresses as confirmed within Supabase. It does not prove email ownership. Avoid relying on email address alone for authorization. mySales uses the verified Supabase *session user ID* mapped to store_owners, not untrusted email text. Identity linking between OAuth and email/password deserves special review: mixed-provider, unverified-email configurations can expose pre-account-takeover risks. Use a separate Supabase Auth project or email verification before high-value accounts if this risk is unacceptable.

**Password recovery trade-off:** Without configured SMTP, self-service reset emails are unavailable for unverified addresses. Users can sign in with their remembered password or a separately provisioned Google identity, but Google accounts may not automatically merge with password accounts in every case.

### 2. Google OAuth

- Open Google Auth Platform (https://console.cloud.google.com/auth/overview), configure consent/branding and required scopes.
- Create **OAuth Client ID → Web application**.
- Authorized JavaScript origins for staging: \`https://mysales-v5-email-staging.onrender.com\`; production: \`https://store.mysalesofficial.com\`.
- Authorized redirect URI for Google's OAuth client must be **Supabase**, not Render:
  \`https://wsxszbdvvtowmrnxdsrp.supabase.co/auth/v1/callback\`
- Save the Google **Client ID** and **Client Secret** in Supabase Dashboard → Authentication → Providers → Google. Do not commit credentials or share the secret in chat.
- Ensure Google project's OAuth consent Audience allows test users, or publish appropriately. Exact Google setup may be subject to Google verification.

### 3. Supabase redirect URLs

Under Authentication → URL Configuration allow exact:
- \`https://mysales-v5-email-staging.onrender.com/login/\`
- \`https://store.mysalesofficial.com/login/\`
- \`https://mysales-early-storefront-branch.onrender.com/login/\`

### 4. Tests

In V5 staging, create one controlled password account and sign out/in again.
Try Google with an authorized test account, confirm return to the staging login route and correct store routing. Test separate account ownership, product CRUD, old private-link claiming, public storefront/WhatsApp checkout, and rejected unauthorized API requests.

The migration \`early_storefront.store_owners\` exists in the shared backend. Staging V5 Edge Functions are separately named and keep the live private-link backend intact. Do not switch production until these integration checks pass.

## Email/Resend
Resend SMTP and custom email verification templates are **not required** for these two login methods. They can be added later for recovery and email notifications. Prior Resend guide stays in the repo as an optional future path.
