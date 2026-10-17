# Email verification — current mySales setup

mySales website generator login uses **Supabase Auth**, with default one-time email sign-in links. Connecting a verified Resend sending domain upgrades **email delivery and branding**, but does not change how login sessions or store ownership work.

- Staging code branch: `feature/storefront-account-login-v5`
- Supabase project: `wsxszbdvvtowmrnxdsrp`
- Sender: `mySales <no-reply@mysalesofficial.com>` (only after domain verification and SMTP setup)
- Template: `docs/auth-verification-email-template.html`
- Full setup steps: `docs/resend-supabase-setup.md`
- Return URL: `/login/`
- Existing live Render branch remains unchanged until staging works.

Until Resend is connected, Supabase's default email delivery remains in force and can be limited to Supabase organization team members. Do not tell prospective merchants that unrestricted email login is available before successful configuration and end-to-end testing.

Authentication rules remain unchanged: verified owner with store → `/manage/`; owner without store → `/create/`; public customers browse the shop without signing in.

This configuration is **not yet complete** until: Resend domain verified; custom SMTP activated; the Magic Link and Confirm signup templates saved; and a real sign-in message successfully received and verified.
