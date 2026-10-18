-- mySales Early Storefront V5: identity-based ownership.
-- Apply to the existing Exam Bank Supabase project in a reviewed production migration.
-- Legacy private links are used only for one-time account transfer before revocation.
BEGIN;
CREATE TABLE IF NOT EXISTS early_storefront.store_owners (
 store_id uuid PRIMARY KEY REFERENCES early_storefront.stores(id) ON DELETE CASCADE,
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS early_storefront_store_owners_user_idx
 ON early_storefront.store_owners(user_id);
ALTER TABLE early_storefront.store_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON early_storefront.store_owners FROM PUBLIC, anon, authenticated;
COMMIT;
