# Phase 2 database verification — 2026-10-13

Supabase project: `become` (`mbabaaqiaktfhodtxltn`). Schema: `early_storefront`.

Executed SQL tests inside `BEGIN ... ROLLBACK` transactions:

1. Unit conversion: 240 base pieces minus 2 cartons x 40 = 160 pieces; passed.
2. Duplicate idempotency key: same sale ID returned and only one inventory movement; passed.
3. Insufficient stock: rejected attempted sale of 5 cartons when only 160 pieces remained; inventory unchanged; passed.
4. Tenant isolation: tenant B cannot record sale using tenant A's product/unit; inventory unchanged; passed.

Tests ran as privileged SQL executor. Not yet tested: concurrent transactions, merchant session authorization, HTTP endpoints, Vercel integration, same idempotency key with changed payload, browser-facing UX. No permanent test rows were intended; test transactions were rolled back.

Do not launch until merchant auth and full end-to-end checks pass.
