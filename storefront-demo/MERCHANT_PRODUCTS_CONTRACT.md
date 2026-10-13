# Merchant product management — implementation contract

All merchant product APIs must derive `store_id` exclusively from the validated HttpOnly session cookie, never from JSON body or query parameters.

## GET /api/merchant/products
Return only the authenticated store's products, unit options and base-unit stock. No credentials, tokens or other stores' data.

## POST /api/merchant/products
Validate: name (1–150 characters), base unit and selling unit (1–40), factor greater than zero, price in NGN at least zero. Create product, selling unit and zero stock in a single database transaction. New products are unpublished until reviewed by merchant.

## POST /api/merchant/restock
Validate product UUID and positive base-unit quantity. Update stock and append an audit movement within one transaction. Both records must belong to the merchant's authenticated store. Never trust a client-supplied store ID.

## Security
Require an active merchant session for all mutations; use parameterized SQL, input length limits, CSRF protection and request size limits. Apply request throttling. Do not permit cross-store access. Do not deduct inventory on WhatsApp clicks. Only explicit confirmed sales use the atomic sale function.

## Acceptance checks
Create a product, list it, restock it, verify audit movement, reject invalid inputs, reject unauthenticated requests, reject cross-store product IDs, and verify rollback on any failure.
