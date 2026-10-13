-- Privacy-preserving storefront adoption events (anonymous browser-tab sessions).
-- Each combination of store/day/event/session is counted once, not one unique person.
-- All dashboard reads require a separate private operator credential in the Edge layer.
CREATE TABLE IF NOT EXISTS early_storefront.activity_events (
 store_id uuid NOT NULL REFERENCES early_storefront.stores(id) ON DELETE CASCADE,
 event_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 event_type text NOT NULL CHECK(event_type IN ('store_view','cart_add','whatsapp_click')),
 session_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,event_day,event_type,session_id)
);
CREATE INDEX IF NOT EXISTS es_activity_date_kind
 ON early_storefront.activity_events(event_day DESC,event_type);
CREATE INDEX IF NOT EXISTS es_activity_store_date
 ON early_storefront.activity_events(store_id,event_day DESC);
REVOKE ALL ON early_storefront.activity_events FROM PUBLIC, anon, authenticated;
-- Tracking begins only after the new frontend and Edge function are deployed.
-- No IP address, device fingerprint, phone number, or customer identity is stored.
