# mySales Early Storefront — migration handoff contract

This document describes how to transfer a merchant from the temporary Render/Supabase storefront into the main mySales ERP **without losing products or inventory**.

## Current status

- Export API: `GET /api/merchant/export`, authorised by the merchant's private management link. Includes the store, products (including archived products), selling units, stock, sales, and stock movements.
- Validated dry-run handoff: `server/migration-export.mjs` exports `prepareMigration()`. It checks for missing or cross-store references and produces a portable manifest without writing any database.
- A separate operator-oriented CLI `scripts/prepare-migration.mjs` can produce an ERP-neutral bundle for manual review.
- **There is no verified importer into the main ERP yet.** Do not tell a merchant that the migration is complete merely because an export or manifest exists.

## Destination mappings

| Source | Main mySales target (proposed) | Notes |
| --- | --- | --- |
| `early_storefront.stores` | Business and a fulfilment Branch | Use an explicitly selected Organization, Business, Branch, not a globally shared record |
| `products` | Organisation-/business-scoped product catalogue | Preserve `sourceProductId`, category, description, image, published and archived states |
| `units` | Selling units / SKU variants | Preserve `factor`, `price_ngn` and `active`; preserve original unit IDs in migration mapping |
| `stock` | Opening Branch inventory | Opening quantity must be **exactly** the exported `quantity_base`; do **not** replay history after applying this opening balance |
| `sales` | Historical sales | Preserve source sale IDs, request keys, quantities, prices, and dates as imported history; don't charge customers again |
| `stock_movements` | Audit/history records | Import as history, not as additional stock adjustments |
| `image_path` | Product media | Copy owned assets to the main media store, update links, check images load before cutover |

## Migration procedure

1. Freeze writes to the merchant's temporary store in a short coordinated cutover window.
2. Export the complete JSON from the private management dashboard.
3. Run an offline validator. Verify there is **exactly one store** and that every product, unit, stock row, sale, and movement belongs to it.
4. Select the target Organisation, Business and specific fulfilment Branch in the main mySales ERP. Never guess the branch.
5. In one database transaction on the **target**, upsert the source-to-target mapping using `(source_system, source_store_id, source_record_id)` as unique keys. Repeated imports must be idempotent.
6. Create target products, units, prices, and media mappings. Import the **opening stock balance once**, per selected Branch.
7. Import prior sales and stock movements as **historical records** only, without replaying inventory deductions.
8. Compare exact product counts (including archived), unit counts, current stock by product, historical sales, image counts and record IDs in a reconciliation report.
9. Only after reconciliation passes, point the merchant's public link to the target site and privately issue the new management link.
10. Retain the original export as a protected backup. Roll back the target transaction and restore the original access route if reconciliation fails.

## Required automated acceptance tests for a future target-side importer

- A 10-product grocery demo and a 10-product printing demo each produce a valid manifest.
- An archived 11th QA product remains recorded as archived, not accidentally published.
- Product IDs never collide across merchants, even if product names match.
- Repeat import causes **zero duplicate products, stock, sales or movements**.
- Historical test sales do not reduce opening stock twice.
- Inventory is assigned to the merchant's selected Branch and nowhere else.
- Invalid or cross-tenant exports are rejected **before** any writes.
- Merchant's new private link opens only their store; old link is revoked after successful cutover.

This migration plan is intentionally separate from the main mySales project. **Do not edit the main ERP schema or run a live migration until its actual entities and RLS permissions have been inspected and these tests pass.**
