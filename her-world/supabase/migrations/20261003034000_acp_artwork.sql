-- Keep artwork separate from character identity. Slots enforce limits under concurrent uploads.
ALTER TABLE her_private.launchpad_assets ADD COLUMN purpose text NOT NULL DEFAULT 'reference' CHECK (purpose IN ('reference','pfp','banner'));
ALTER TABLE her_private.launchpad_assets ADD COLUMN slot integer;
WITH numbered AS (SELECT id,row_number() OVER (PARTITION BY character_id ORDER BY created_at,id)-1 AS n FROM her_private.launchpad_assets)
UPDATE her_private.launchpad_assets SET slot=numbered.n FROM numbered WHERE launchpad_assets.id=numbered.id;
ALTER TABLE her_private.launchpad_assets ALTER COLUMN slot SET NOT NULL;
ALTER TABLE her_private.launchpad_assets ADD CONSTRAINT launchpad_asset_slot CHECK ((purpose='reference' AND slot BETWEEN 0 AND 3) OR (purpose IN ('pfp','banner') AND slot=0));
ALTER TABLE her_private.launchpad_assets DROP CONSTRAINT launchpad_assets_character_id_digest_key;
ALTER TABLE her_private.launchpad_assets ADD UNIQUE (character_id,purpose,digest);
ALTER TABLE her_private.launchpad_assets ADD UNIQUE (character_id,purpose,slot);
