-- Retention foundations: an explicit opt-in for inventory and privacy-respecting merchant usage.
ALTER TABLE early_storefront.products ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false;
-- Preserve precise stock control for merchants who have already entered positive quantities.
UPDATE early_storefront.products AS p SET track_stock=true
FROM early_storefront.stock AS s WHERE s.product_id=p.id AND s.store_id=p.store_id
AND s.quantity_base>0 AND p.track_stock=false;
CREATE TABLE IF NOT EXISTS early_storefront.merchant_activity_events(
 store_id uuid NOT NULL REFERENCES early_storefront.stores(id) ON DELETE CASCADE,
 event_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 event_type text NOT NULL CHECK(event_type IN ('dashboard_open','shop_share','product_share')),
 session_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (store_id,event_day,event_type,session_id)
);
CREATE INDEX IF NOT EXISTS es_merchant_activity_day ON early_storefront.merchant_activity_events(event_day DESC,event_type);
REVOKE ALL ON early_storefront.merchant_activity_events FROM PUBLIC,anon,authenticated;
-- No phone, IP, email, tokens or device fingerprints are captured.
