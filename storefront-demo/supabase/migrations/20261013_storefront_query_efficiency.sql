-- Early Storefront only. Applied to Supabase project wsxszbdvvtowmrnxdsrp
-- on 2026-10-13; included in GitHub for repeatable deployments.
-- Reduce unnecessary work on each product/stock movement/sale write.
-- These secondary indexes duplicated equivalent surviving indexes.
DROP INDEX IF EXISTS early_storefront.es_product_recent;
DROP INDEX IF EXISTS early_storefront.es_sales_store_recent;
DROP INDEX IF EXISTS early_storefront.es_movement_store_recent;

-- Speeds duplicate-phone validation during the public merchant creation flow.
-- Matching expression used by early-storefront-signup.
CREATE INDEX IF NOT EXISTS es_signup_whatsapp_recent
ON early_storefront.stores (
  (regexp_replace(whatsapp, '[^0-9]', '', 'g')),
  created_at DESC
);
