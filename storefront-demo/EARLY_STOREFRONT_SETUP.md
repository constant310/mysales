# mySales Early Storefront (distribution pilot)

This is the isolated development track for the free mySales storefront, based on `demo/storefront-template-01`. **Do not deploy the repository's main ERP branch to this project.**

## Purpose
Give merchants free product catalogues with WhatsApp enquiries while the main mySales ERP is developed. Keep business, product, unit and inventory data migration-ready.

## Infrastructure
- GitHub branch: `feature/early-storefront-vercel`
- Vercel project: `mysales-early-storefront` (not yet deployed or connected to Git)
- Supabase: dedicated project **pending organization and cost confirmation**; do not use the existing production mySales database.
- Render demo: reference implementation only.

## Planned application
- One multi-tenant storefront application; each store has a stable UUID and unique public slug.
- Phone + strong generated access code, hashed server-side, with separate recovery credentials and secure cookie sessions.
- Products, configurable selling units and conversion factors, inventory movements and merchant-confirmed sales. WhatsApp enquiry alone must not deduct inventory.
- Optimized product images in Supabase Storage; database stores references, not binary images.
- Versioned JSON/CSV export for future ERP migration.

## Phase 1 checklist
- [x] Confirm GitHub, Vercel and Supabase connectivity.
- [x] Create isolated GitHub development branch.
- [x] Create isolated Vercel project (no deployment yet).
- [ ] Inspect all relevant demo files and choose server framework.
- [ ] Confirm Supabase organization and project creation cost; create dedicated project.
- [ ] Implement app foundation and connect isolated Git branch to Vercel.
- [ ] Set environment variables and run smoke tests.

## Safety
Never commit credentials, raw management codes, Supabase service keys or database passwords. Do not change the main ERP's code, database or Vercel project.
