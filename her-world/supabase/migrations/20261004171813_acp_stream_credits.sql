CREATE TABLE her_private.stream_credit_accounts (
 character_id text PRIMARY KEY, wallet text NOT NULL,
 stream_seconds bigint NOT NULL DEFAULT 0 CHECK(stream_seconds>=0),
 video_seconds bigint NOT NULL DEFAULT 0 CHECK(video_seconds>=0),
 ends_at bigint NOT NULL DEFAULT 0 CHECK(ends_at>=0), session_id text,
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE TABLE her_private.stream_credit_burns (
 id text PRIMARY KEY, character_id text NOT NULL, wallet text NOT NULL, mint text NOT NULL,
 minutes integer NOT NULL CHECK(minutes IN (15,30,45,60)), raw_amount text NOT NULL, program text NOT NULL,
 message text NOT NULL, created_at bigint NOT NULL, expires bigint NOT NULL,
 signature text UNIQUE, status text NOT NULL CHECK(status IN ('prepared','submitted','credited')),
 FOREIGN KEY(character_id,wallet) REFERENCES her_private.launchpad_characters(id,wallet)
);
CREATE INDEX stream_credit_burn_owner ON her_private.stream_credit_burns(character_id,wallet,created_at DESC);
GRANT SELECT,INSERT,UPDATE,DELETE ON her_private.stream_credit_accounts,her_private.stream_credit_burns TO her_web;
REVOKE ALL ON her_private.stream_credit_accounts,her_private.stream_credit_burns FROM PUBLIC,anon,authenticated;
ALTER TABLE her_private.stream_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.stream_credit_burns ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.stream_credit_accounts TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.stream_credit_burns TO her_web USING(true) WITH CHECK(true);
