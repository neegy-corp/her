-- Isolated launchpad data. Existing wallet, burns and voting storage are untouched.
CREATE TABLE her_private.launchpad_characters (
 id text PRIMARY KEY, wallet text NOT NULL, document text NOT NULL CHECK(length(document)<=24000),
 image_url text, image_fingerprint text, face_id text, pal_id text,
 face_status text NOT NULL DEFAULT 'draft' CHECK(face_status IN ('draft','submitting','training','ready','failed')),
 mint text UNIQUE, signature text UNIQUE, updated_at bigint NOT NULL,
 UNIQUE(id,wallet)
);
CREATE INDEX launchpad_character_owner ON her_private.launchpad_characters(wallet,updated_at DESC);
CREATE TABLE her_private.launchpad_usage (wallet text NOT NULL,bucket bigint NOT NULL,attempts integer NOT NULL CHECK(attempts>0),PRIMARY KEY(wallet,bucket));
CREATE TABLE her_private.launchpad_coins (
 id text PRIMARY KEY, wallet text NOT NULL,mint text NOT NULL UNIQUE,message text NOT NULL,transaction text NOT NULL,
 expires bigint NOT NULL,signature text UNIQUE,status text NOT NULL CHECK(status IN ('prepared','submitted','confirmed')),
 FOREIGN KEY(id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE TABLE her_private.launchpad_assets (
 id text PRIMARY KEY, character_id text NOT NULL,wallet text NOT NULL,url text NOT NULL,digest text NOT NULL,created_at bigint NOT NULL,
 UNIQUE(character_id,digest),FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE INDEX launchpad_asset_owner ON her_private.launchpad_assets(character_id,wallet,created_at);
CREATE TABLE her_private.launchpad_renders (
 id text PRIMARY KEY,character_id text NOT NULL,wallet text NOT NULL,clip_id text NOT NULL,fingerprint text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('tavus','fal')),provider_id text,status text NOT NULL CHECK(status IN ('submitting','queued','ready','failed')),
 video_url text,created_at bigint NOT NULL,UNIQUE(character_id,clip_id,fingerprint),
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE INDEX launchpad_render_owner ON her_private.launchpad_renders(character_id,wallet,created_at DESC);
GRANT SELECT,INSERT,UPDATE,DELETE ON her_private.launchpad_characters,her_private.launchpad_usage,her_private.launchpad_coins,her_private.launchpad_assets,her_private.launchpad_renders TO her_web;
REVOKE ALL ON her_private.launchpad_characters,her_private.launchpad_usage,her_private.launchpad_coins,her_private.launchpad_assets,her_private.launchpad_renders FROM PUBLIC,anon,authenticated;
ALTER TABLE her_private.launchpad_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.launchpad_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.launchpad_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.launchpad_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.launchpad_renders ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.launchpad_characters TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.launchpad_usage TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.launchpad_coins TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.launchpad_assets TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.launchpad_renders TO her_web USING(true) WITH CHECK(true);
