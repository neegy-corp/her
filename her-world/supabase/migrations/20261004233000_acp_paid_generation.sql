-- Paid media allowances and a lifetime fulfillment ceiling. No automatic free grant.
ALTER TABLE her_private.stream_credit_accounts ADD COLUMN portrait_credits bigint NOT NULL DEFAULT 0 CHECK(portrait_credits>=0);
ALTER TABLE her_private.stream_credit_accounts ADD COLUMN script_credits bigint NOT NULL DEFAULT 0 CHECK(script_credits>=0);
ALTER TABLE her_private.time_purchases ADD COLUMN reserve_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserve_micro_usd>=0);
CREATE TABLE her_private.generation_capacity (id text PRIMARY KEY, reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_micro_usd>=0));
INSERT INTO her_private.generation_capacity(id) VALUES ('acp');
GRANT SELECT,INSERT,UPDATE,DELETE ON her_private.generation_capacity TO her_web;
REVOKE ALL ON her_private.generation_capacity FROM PUBLIC,anon,authenticated;
ALTER TABLE her_private.generation_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.generation_capacity TO her_web USING(true) WITH CHECK(true);
