-- Fee-funded video: custodial launch wallets, one-time free grant, time purchases paid from the launch wallet.
CREATE TABLE her_private.launch_wallets (
 character_id text PRIMARY KEY, wallet text NOT NULL, public_key text NOT NULL UNIQUE,
 sealed_secret text NOT NULL, created_at bigint NOT NULL, exported_at bigint,
 fee_setup_status text NOT NULL DEFAULT 'none' CHECK(fee_setup_status IN ('none','submitted','confirmed')),
 fee_setup_signature text, fee_setup_at bigint, fee_setup_last_valid_height bigint,
 collection_signature text, collection_last_valid_height bigint,
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE TABLE her_private.time_purchases (
 signature text PRIMARY KEY, character_id text NOT NULL, wallet text NOT NULL,
 request_id text NOT NULL, last_valid_block_height bigint NOT NULL CHECK(last_valid_block_height>0),
 minutes integer NOT NULL CHECK(minutes IN (5,10,15,20,25)), lamports bigint NOT NULL CHECK(lamports>0),
 status text NOT NULL CHECK(status IN ('submitted','credited','expired')), created_at bigint NOT NULL,
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet),
 UNIQUE(character_id,request_id)
);
CREATE INDEX time_purchase_character ON her_private.time_purchases(character_id,created_at DESC);
-- Even different request IDs cannot submit concurrent payments from one character.
CREATE UNIQUE INDEX time_purchase_one_pending ON her_private.time_purchases(character_id) WHERE status='submitted';
CREATE TABLE her_private.free_video_grants (
 character_id text PRIMARY KEY, wallet text NOT NULL, seconds bigint NOT NULL CHECK(seconds>0), created_at bigint NOT NULL,
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON her_private.launch_wallets,her_private.time_purchases,her_private.free_video_grants TO her_web;
REVOKE ALL ON her_private.launch_wallets,her_private.time_purchases,her_private.free_video_grants FROM PUBLIC,anon,authenticated;
ALTER TABLE her_private.launch_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.time_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.free_video_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.launch_wallets TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.time_purchases TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.free_video_grants TO her_web USING(true) WITH CHECK(true);
