-- HER server-owned data. This schema is deliberately outside the public Data API.
CREATE ROLE her_web NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA her_private;
REVOKE ALL ON SCHEMA her_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA her_private TO her_web;

CREATE TABLE her_private.challenges (id text PRIMARY KEY, wallet text NOT NULL, message text NOT NULL, expires bigint NOT NULL);
CREATE INDEX challenge_expiry ON her_private.challenges (expires);
CREATE TABLE her_private.wallet_sessions (id text PRIMARY KEY, wallet text NOT NULL, expires bigint NOT NULL);
CREATE INDEX session_expiry ON her_private.wallet_sessions (expires);
CREATE TABLE her_private.burn_intents (
 id text PRIMARY KEY, wallet text NOT NULL, kind text NOT NULL CHECK (kind IN ('character','stage')),
 character text, amount text NOT NULL, raw_amount text NOT NULL, mint text NOT NULL,
 decimals integer NOT NULL, program text NOT NULL, name text NOT NULL, topic text NOT NULL,
 created_at bigint NOT NULL, expires bigint NOT NULL, submitted_signature text
);
CREATE INDEX intent_wallet ON her_private.burn_intents(wallet);
CREATE TABLE her_private.burn_receipts (
 id text PRIMARY KEY REFERENCES her_private.burn_intents(id), wallet text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('character','stage')), character text,
 amount text NOT NULL, signature text NOT NULL UNIQUE, created_at bigint NOT NULL
);
CREATE INDEX burn_wallet ON her_private.burn_receipts(wallet);
CREATE TABLE her_private.stage_requests (
 id text PRIMARY KEY REFERENCES her_private.burn_receipts(id), wallet text NOT NULL,
 name text NOT NULL, topic text NOT NULL,
 status text NOT NULL CHECK (status IN ('pending','accepted','rejected','on_stage','ended')),
 created_at bigint NOT NULL, invite_url text, stage_slot integer NOT NULL DEFAULT 1 CHECK (stage_slot = 1)
);
CREATE UNIQUE INDEX one_on_stage_guest ON her_private.stage_requests(stage_slot) WHERE status = 'on_stage';
CREATE INDEX stage_status ON her_private.stage_requests(status);
CREATE TABLE her_private.moderation_log (
 id text PRIMARY KEY, request_id text NOT NULL REFERENCES her_private.stage_requests(id),
 host text NOT NULL, action text NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX moderation_request ON her_private.moderation_log(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA her_private TO her_web;
REVOKE ALL ON ALL TABLES IN SCHEMA her_private FROM PUBLIC, anon, authenticated;
DO $$ DECLARE table_name text; BEGIN
 FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'her_private' LOOP
  EXECUTE format('ALTER TABLE her_private.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('CREATE POLICY her_server_access ON her_private.%I TO her_web USING (true) WITH CHECK (true)', table_name);
 END LOOP;
END $$;
