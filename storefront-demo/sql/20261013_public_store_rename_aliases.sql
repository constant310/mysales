-- mySales early storefront: preserve old business-name links after a business renames.
CREATE TABLE IF NOT EXISTS early_storefront.public_handle_aliases(
 handle text PRIMARY KEY,
 store_id uuid NOT NULL REFERENCES early_storefront.stores(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS early_storefront_handle_alias_store_idx ON early_storefront.public_handle_aliases(store_id);

-- New store handle allocation also respects aliases.
CREATE OR REPLACE FUNCTION early_storefront.assign_public_handle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE base_handle text;candidate text;counter integer;
BEGIN
 base_handle:=trim(both '-' from left(lower(regexp_replace(trim(NEW.name),'[^A-Za-z0-9]+','-','g')),60));
 IF base_handle='' THEN base_handle:='store'; END IF;
 IF base_handle=ANY(ARRAY['api','s','manage','operator','create','discover','health','favicon','assets','admin','login','signup','robots','index','store','stores','home','static']) THEN base_handle:=base_handle||'-shop'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('early_storefront_public_handle:'||base_handle));
 candidate:=base_handle;counter:=2;
 WHILE EXISTS (SELECT 1 FROM early_storefront.stores WHERE public_handle=candidate)
    OR EXISTS (SELECT 1 FROM early_storefront.public_handle_aliases WHERE handle=candidate) LOOP
  candidate:=left(base_handle,60-length(counter::text)-1)||'-'||counter;
  counter:=counter+1;
 END LOOP;
 NEW.public_handle:=candidate;
 RETURN NEW;
END $body$;

CREATE OR REPLACE FUNCTION early_storefront.update_public_handle_for_business_name()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE base_handle text;candidate text;counter integer;
BEGIN
 base_handle:=trim(both '-' from left(lower(regexp_replace(trim(NEW.name),'[^A-Za-z0-9]+','-','g')),60));
 IF base_handle='' THEN base_handle:='store'; END IF;
 IF base_handle=ANY(ARRAY['api','s','manage','operator','create','discover','health','favicon','assets','admin','login','signup','robots','index','store','stores','home','static']) THEN base_handle:=base_handle||'-shop'; END IF;
 IF base_handle=OLD.public_handle THEN RETURN NEW; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('early_storefront_public_handle:'||base_handle));
 candidate:=base_handle;counter:=2;
 WHILE EXISTS (SELECT 1 FROM early_storefront.stores WHERE public_handle=candidate AND id<>NEW.id)
    OR EXISTS (SELECT 1 FROM early_storefront.public_handle_aliases WHERE handle=candidate AND store_id<>NEW.id) LOOP
  candidate:=left(base_handle,60-length(counter::text)-1)||'-'||counter;
  counter:=counter+1;
 END LOOP;
 IF candidate<>OLD.public_handle THEN
  INSERT INTO early_storefront.public_handle_aliases(handle,store_id)
   VALUES(OLD.public_handle,NEW.id) ON CONFLICT(handle) DO NOTHING;
  DELETE FROM early_storefront.public_handle_aliases WHERE handle=candidate AND store_id=NEW.id;
  NEW.public_handle:=candidate;
 END IF;
 RETURN NEW;
END $body$;

DROP TRIGGER IF EXISTS update_public_handle_on_store_rename ON early_storefront.stores;
CREATE TRIGGER update_public_handle_on_store_rename
BEFORE UPDATE OF name ON early_storefront.stores
FOR EACH ROW EXECUTE FUNCTION early_storefront.update_public_handle_for_business_name();

-- Reconcile stores that were renamed before this feature was enabled.
UPDATE early_storefront.stores SET name=name
 WHERE public_handle<>trim(both '-' from left(lower(regexp_replace(trim(name),'[^A-Za-z0-9]+','-','g')),60));
