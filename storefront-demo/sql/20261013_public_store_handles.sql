-- Versioned reference for Supabase migration storefront_business_name_public_handles.
-- Public business URLs use /<business-name>; internal slugs remain for legacy links.
ALTER TABLE early_storefront.stores ADD COLUMN IF NOT EXISTS public_handle text;
DO $migration$
DECLARE item record; base_handle text; candidate text; counter integer;
BEGIN
 FOR item IN SELECT id,name FROM early_storefront.stores WHERE public_handle IS NULL ORDER BY created_at,id LOOP
  base_handle:=trim(both '-' from left(lower(regexp_replace(trim(item.name),'[^A-Za-z0-9]+','-','g')),60));
  IF base_handle='' THEN base_handle:='store'; END IF;
  IF base_handle=ANY(ARRAY['api','s','manage','operator','create','discover','health','favicon','assets','admin','login','signup','robots','index','store','stores','home','static']) THEN base_handle:=base_handle||'-shop'; END IF;
  candidate:=base_handle;counter:=2;
  WHILE EXISTS (SELECT 1 FROM early_storefront.stores WHERE public_handle=candidate) LOOP
   candidate:=left(base_handle,60-length(counter::text)-1)||'-'||counter;counter:=counter+1;
  END LOOP;
  UPDATE early_storefront.stores SET public_handle=candidate WHERE id=item.id;
 END LOOP;
END $migration$;
CREATE UNIQUE INDEX IF NOT EXISTS early_storefront_public_handle_unique ON early_storefront.stores(public_handle);
CREATE OR REPLACE FUNCTION early_storefront.assign_public_handle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE base_handle text; candidate text; counter integer;
BEGIN
 base_handle:=trim(both '-' from left(lower(regexp_replace(trim(NEW.name),'[^A-Za-z0-9]+','-','g')),60));
 IF base_handle='' THEN base_handle:='store'; END IF;
 IF base_handle=ANY(ARRAY['api','s','manage','operator','create','discover','health','favicon','assets','admin','login','signup','robots','index','store','stores','home','static']) THEN base_handle:=base_handle||'-shop'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('early_storefront_public_handle:'||base_handle));
 candidate:=base_handle;counter:=2;
 WHILE EXISTS (SELECT 1 FROM early_storefront.stores WHERE public_handle=candidate) LOOP
  candidate:=left(base_handle,60-length(counter::text)-1)||'-'||counter;counter:=counter+1;
 END LOOP;
 NEW.public_handle:=candidate;RETURN NEW;
END $body$;
DROP TRIGGER IF EXISTS set_public_handle_on_new_store ON early_storefront.stores;
CREATE TRIGGER set_public_handle_on_new_store BEFORE INSERT ON early_storefront.stores
FOR EACH ROW EXECUTE FUNCTION early_storefront.assign_public_handle();
ALTER TABLE early_storefront.stores ALTER COLUMN public_handle SET NOT NULL;
ALTER TABLE early_storefront.stores ADD CONSTRAINT early_storefront_public_handle_format CHECK (public_handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
COMMENT ON COLUMN early_storefront.stores.public_handle IS 'Unique customer-facing business-name path; stable across name changes. Old slug links continue working.';
