# mySales Resend + Supabase Auth setup

This guide is for the **existing website generator**, Supabase project `wsxszbdvvtowmrnxdsrp` and `feature/storefront-account-login-v5` development branch.

## Goal
- Sender name: **mySales**
- Sender email: `no-reply@mysalesofficial.com`
- Recipient: any genuine merchant (once verified and configured)
- Authentication: Supabase Auth **magic links** (not a new Resend login system)
- Branded HTML: `docs/auth-verification-email-template.html`
- Continue using the existing `/login/` callback, seller dashboard and public customer shop.

## Domain verification (Resend + domain DNS provider)
1. Create or sign in at https://resend.com/domains.
2. Add `mysalesofficial.com` as the **sending domain**. Use its domain verification page.
3. In the authoritative DNS provider (previously Namecheap for the domain), add the **exact TXT/MX/CNAME verification records** Resend actually displays, preserving record names, type and value. Do **not** guess verification values or copy placeholder DNS records.
4. Resend generally provides DKIM and a sending-subdomain SPF/MX set; these should not require changes to the website's apex A record or its `store` CNAME. **Never delete existing website or inbound-mail MX records.**
5. If there is already an SPF TXT record at the same hostname, merge compatible mechanisms rather than creating two conflicting SPF records. This depends on exact Resend names displayed.
6. Return to Resend and choose Verify. Do not activate sending until it reports the domain verified.

## Connect Resend to Supabase
### Preferred: partner integration
Use https://supabase.com/partners/catalog/resend → **Add integration** and follow the connection flow for Supabase project `wsxszbdvvtowmrnxdsrp`. This can automatically populate project SMTP credentials. Check that the sender is `no-reply@mysalesofficial.com` with name `mySales`.

### Alternative: manually configure SMTP
In Supabase Dashboard → Authentication → SMTP Settings / Emails → SMTP, enable custom SMTP and enter:
| Field | Value |
|---|---|
| Sender email | `no-reply@mysalesofficial.com` |
| Sender name | `mySales` |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` (SSL/TLS) |
| Username | `resend` |
| Password | **Resend API key, entered directly in Supabase** |

Do not put any Resend API key in this repository, in ChatGPT or in a screenshot.

## Set branded templates in Supabase
Once custom SMTP is enabled, Supabase's free-tier template editor is unlocked.
- Under **Authentication → Email Templates → Magic Link or OTP**, subject: `Sign in securely to mySales`.
- Paste the contents of `docs/auth-verification-email-template.html` into the HTML editor.
- Under **Confirm signup**, subject: `Verify your email for mySales`; paste the same HTML.
- Preserve **`{{ .ConfirmationURL }}`** exactly, as Supabase fills in the secure confirmation link.
- Do not replace with a fixed storefront URL. The template is **link-first**, matching current V5 login (no code input).

## Redirects
Under Supabase Authentication → URL Configuration include:
- `https://store.mysalesofficial.com/login/`
- `https://mysales-early-storefront-branch.onrender.com/login/`
- `https://mysales-v5-email-staging.onrender.com/login/`

Only change Site URL if the Supabase project does not host another app relying on its existing Site URL. Do not enable wildcard external callbacks.

## Testing and operational safety
1. Do a test send to an inbox you control (never use real merchant addresses for unannounced tests).
2. Confirm the email says mySales, and SPF/DKIM verification has passed for the verified domain.
3. Click the button and confirm it returns to the allowlisted staging `/login/` route with an authenticated session.
4. Check existing owner → `/manage/`, new owner → `/create/`, invalid/expired link → resend.
5. Confirm cross-owner data isolation and guest catalogue/cart/WhatsApp enquiry.
6. In Resend inspect delivery, bounce and spam issues without logging credentials.
7. Keep the production Render branch unchanged until the staged login/store tests pass.
8. Both Resend's daily/monthly quota and Supabase's auth email rate limits apply. Update rate limits conservatively as traffic grows.

No API key and no DNS value is bundled in the repository. Resend service setup and Supabase Auth settings require account access.

Official sources:
- https://supabase.com/partners/catalog/resend
- https://resend.com/changelog/smtp-service
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
