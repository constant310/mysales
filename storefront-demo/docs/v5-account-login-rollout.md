# Early storefront V5 — login migration rollout

## Scope
This work updates the existing Render generator from `constant310/mysales` on branch
`feature/early-storefront-vercel`, not the full mySales ERP.
The V5 implementation is a development branch. **Do not point the production Render
service to it until the steps below are complete.**

## Routes
- `/login/`: verified email OTP signup/login; both actions use one screen.
- `/create/`: sellers without an existing store, authenticated only.
- `/manage/`: sellers with an owned store, authenticated only.
- `/{public_handle}`: public live store, no login; preserves product list, cart, quantities and WhatsApp checkout.
- `/buy/` and `/explore/`: reserved; do not present navigation to customers yet.

## Owner security
Supabase Auth establishes user identity using verified email OTP.
Backend validates each access token using Supabase Auth /user and checks
`early_storefront.store_owners` for the correct store. Never trust a store ID
provided by a browser; legacy management tokens are not valid for routine
merchant data operations.
Old managers can claim exactly one unowned store after they sign in using
their old link as *one-time proof*; the claim transaction revokes the old link.
A separate operator/admin login migration is out of scope; operator links remain
an isolated internal access path in this phase.

## Release checklist
1. Review migration; apply `sql/20261017_account_store_owners.sql` to Supabase
   project `wsxszbdvvtowmrnxdsrp` after backup and rollback plan.
2. Configure Supabase Auth email template to supply OTP code or a working
   `/login/` magic-link callback, and allow both official and Render redirect URLs.
3. Deploy the updated `early-storefront-backend` and `early-storefront-signup`
   Edge Functions using verified JWT signatures / Supabase `auth.getUser`.
4. Test two distinct accounts and both owned/unowned store cases, all protected
   product endpoints and one-time existing-store transfer.
5. Confirm public store pages and cart/WhatsApp checkout still work as guests.
6. Move Render branch only after integration and authorization tests pass.
7. Monitor errors and be ready to roll back to the previous branch and Edge versions.

Do not issue any new private merchant management links after cutover.
Do not merge new auth UI against the old Edge Functions: it would lock out merchants.
