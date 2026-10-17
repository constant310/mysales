# Default Supabase Auth — mySales website generator

The site uses **Default Supabase Auth magic links**, not a custom SMTP provider or custom email templates.

## Development behavior
- Sellers enter an email and click "Send sign-in link".
- The application requests `POST /auth/v1/otp` with a callback to `/login/`.
- Supabase's **default email templates** send a verification/sign-in link. Users click this link; there is no six-digit-code field.
- Supabase verifies the link, returning the session via URL fragment. The `/login/` callback captures the session and clears the fragment.
- Returning sellers open `/manage/`. Signed-in new sellers open `/create/`.
- Existing merchants claim their old store once after sign-in. Guest customer catalogue, cart and WhatsApp checkout require no login.

## Supabase Dashboard setup
Project: `wsxszbdvvtowmrnxdsrp` (Exam Bank, currently used by the early storefront).

1. Under **Authentication → Providers → Email**, enable the Email provider. Keep email confirmation on.
2. Keep **Authentication → Email Templates → Magic Link or OTP** and **Confirm signup** on their default templates. **Do not edit the templates or click "Set up SMTP"** for this initial development phase.
3. Under **Authentication → URL Configuration**, add exact Redirect URLs:
   - `https://store.mysalesofficial.com/login/`
   - `https://mysales-early-storefront-branch.onrender.com/login/`
   - Exact staging preview callback if one is deployed.
   If it does not conflict with other apps in the same project, set Site URL to `https://store.mysalesofficial.com`. Otherwise leave Site URL unchanged and ensure explicit redirects are allowlisted.
4. Under **Authentication → Rate Limits**, check current email limits and default expiry (normally magic links once per 60 seconds, expiration about an hour).

## Limitations of Supabase's built-in mail delivery
**Supabase default mail delivery is for development, not public merchant onboarding.**
Supabase's official Auth SMTP documentation currently states that without custom SMTP, Auth emails
are delivered only to email addresses belonging to members of the project's organization/team.
Default quotas are low. Thus testing should use a consented **team member** inbox.
This does **not** solve email delivery for prospective merchants.
Before enabling general signups, arrange a production email provider; there is no compliant
frontend-only bypass of the built-in delivery restriction.

## Release sequence
- Keep the Render production branch unchanged.
- Apply the reviewed `sql/20261017_account_store_owners.sql` migration with rollback planning.
- Deploy both updated Supabase Edge Functions together with the new identity-based seller frontend.
- Verify sign-in with an authorized team inbox, redirect, logout, account isolation and one-time merchant migration.
- Test live public store, quantity, cart and WhatsApp checkout.
- Deploy to staging before any production cutover.

**No SMTP credentials, API secrets, or template changes are required for these development tests.**
Documentation: https://supabase.com/docs/guides/auth/auth-smtp and
https://supabase.com/docs/guides/auth/auth-email-passwordless
