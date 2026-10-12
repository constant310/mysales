# Phase 2: Early Storefront database

Supabase project: `become` (`mbabaaqiaktfhodtxltn`).
Schema: `early_storefront`, isolated from existing `public.schedulers` and `public.activities`.

Created nine RLS-enabled tables: stores, products, units, stock, sales, sale_items, stock_movements, credentials, sessions.

Next: implement server-side authenticated endpoints; do not expose service-role credentials in browser code. WhatsApp enquiries must not modify inventory. Sales must use an atomic transaction and idempotency key.

Deployment: dedicated Vercel project `mysales-early-storefront`, test deployment succeeded. The app itself is not deployed yet.
