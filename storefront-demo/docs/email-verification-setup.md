# mySales website generator — email verification setup

## What was implemented
The existing Render website generator now has a tested-in-source email verification experience on the
development branch \`feature/storefront-account-login-v5\` (PR #15). A single login/signup form:
1. Sends email OTP via **Supabase Auth**.
2. Accepts a six-digit code through the Supabase Auth \`/verify\` endpoint.
3. Supports Supabase's magic-link callbacks (fragment session tokens or \`token_hash\` links).
4. Handles resend cooldown, incorrect/expired codes, offline errors, and returning users.
5. Routes a verified seller to existing account-owned \`/manage/\`, or a new seller to \`/create/\`.
6. Does not create or authenticate any customer session for a shared public shop link.

**Do not deploy only the frontend.** It must ship with the V5 SQL migration, seller API and signup
Edge Functions, and production site URL configuration, otherwise sellers may be locked out.

## Supabase project and settings

Target Supabase project: \`wsxszbdvvtowmrnxdsrp\` ("Exam Bank"); this project currently backs
the Render website generator. Do not use the ERP's different Supabase project.

1. In Supabase Dashboard open **Authentication → Providers → Email**:
   enable Email and require confirmed email addresses. Enable new-user signups for seller onboarding.
2. In **Authentication → URL Configuration**, set Site URL to
   \`https://store.mysalesofficial.com\` (if this project hosts no other auth applications
   requiring a different Site URL) and add these exact Redirect URLs:
   - \`https://store.mysalesofficial.com/login/\`
   - \`https://mysales-early-storefront-branch.onrender.com/login/\`
   Add the exact staging preview \`/login/\` URL separately if used. Avoid broad wildcard origins.
3. In **Authentication → Email Templates**, edit both **Magic Link** and **Confirm signup**
   templates to send a six-digit code and a functional confirmation link. Use
   \`docs/auth-verification-email-template.html\` for their HTML contents and
   "Your mySales verification code" as subject.
   The supported variables are \`{{ .Token }}\` and \`{{ .ConfirmationURL }}\`.
   The live template settings must be changed in Supabase Dashboard; editing this file alone
   DOES NOT alter what Supabase currently emails.
4. Review **Authentication → Rate Limits** and email OTP expiry settings. The UI has a 60-second
   cooldown for convenience; Supabase must enforce backend limits.
5. For a production rollout beyond small tests, configure a verified-domain custom SMTP provider
   and test deliverability, suppression, domain SPF/DKIM and recipient restrictions.
   Supabase's default email sending service is limited and may only be suitable for testing.

## Integration checklist
- Use **two controlled test inboxes**. Do not send unexpected test messages to real sellers.
- First email signup: receive OTP, verify, store-owner creation succeeds.
- Existing email login on another device: receive OTP and land on the same store.
- Invalid OTP: sign-in rejected, no access to protected seller APIs.
- Expired OTP/link: shows an error and allows resend.
- 60-second resend interaction; backend rate limits apply even if frontend is bypassed.
- Email link: clicking it completes sign-in at the allowlisted \`/login/\` route.
- Signed-out access: \`/manage/\` and \`/create/\` redirect to login.
- Legacy store transfer: authenticated user supplies the old link once; owner mapping succeeds;
  old private link is revoked and existing products remain unchanged.
- Guest customer: public product list, selection, cart and WhatsApp enquiry still work.
- Cross-account isolation: Account A cannot mutate Account B's store.

## Important limitations
- No changes have been applied to the production Supabase Auth email templates or SMTP settings
  from this repository. Those are account configuration controlled in Supabase Dashboard.
- The production Render service must remain on its existing branch until the identity mapping
  SQL migration and updated Edge Functions are deployed and tested together.
- Google login is a separate future feature; only email verification is in this release.

References: https://supabase.com/docs/guides/auth/auth-email-templates
