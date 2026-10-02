CREATE TABLE her_private.operator_limits (id text PRIMARY KEY, bucket bigint NOT NULL, attempts integer NOT NULL, expires bigint NOT NULL);
CREATE INDEX operator_limit_expiry ON her_private.operator_limits(expires);
CREATE TABLE her_private.operator_notes (
 wallet text NOT NULL, mint text NOT NULL, thesis text NOT NULL CHECK (length(thesis) BETWEEN 10 AND 1200),
 updated_at bigint NOT NULL, PRIMARY KEY (wallet,mint)
);
CREATE TABLE her_private.operator_orders (
 id text PRIMARY KEY, wallet text NOT NULL, mint text NOT NULL, side text NOT NULL CHECK (side IN ('buy','sell')),
 amount text NOT NULL, thesis text NOT NULL, token_name text NOT NULL, symbol text NOT NULL, decimals integer NOT NULL,
 request_id text NOT NULL, transaction_message text NOT NULL, unsigned_transaction text NOT NULL, out_amount text NOT NULL,
 expires bigint NOT NULL, created_at bigint NOT NULL,
 status text NOT NULL CHECK (status IN ('prepared','submitting','submitted','confirmed','failed','unknown')),
 signature text UNIQUE
);
CREATE INDEX operator_order_wallet ON her_private.operator_orders(wallet,created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON her_private.operator_limits, her_private.operator_notes, her_private.operator_orders TO her_web;
REVOKE ALL ON her_private.operator_limits, her_private.operator_notes, her_private.operator_orders FROM PUBLIC, anon, authenticated;
ALTER TABLE her_private.operator_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.operator_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.operator_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.operator_limits TO her_web USING (true) WITH CHECK (true);
CREATE POLICY her_server_access ON her_private.operator_notes TO her_web USING (true) WITH CHECK (true);
CREATE POLICY her_server_access ON her_private.operator_orders TO her_web USING (true) WITH CHECK (true);
