-- Private server-owned votes; no browser can insert a receipt or choose a winner.
CREATE TABLE her_private.character_control (
 id integer PRIMARY KEY CHECK(id=1), enabled boolean NOT NULL DEFAULT false,
 desired text NOT NULL DEFAULT 'olivia' CHECK(desired IN ('olivia','maya','ivy')),
 actual text NOT NULL DEFAULT 'olivia' CHECK(actual IN ('olivia','maya','ivy')),
 revision bigint NOT NULL DEFAULT 0, heartbeat bigint NOT NULL DEFAULT 0,
 healthy boolean NOT NULL DEFAULT false
);
INSERT INTO her_private.character_control(id) VALUES(1);
CREATE TABLE her_private.character_rounds (
 id bigint PRIMARY KEY, ends_at bigint NOT NULL, settled_at bigint,
 winner text, reason text, CHECK(ends_at=id+1800000)
);
INSERT INTO her_private.character_rounds(id,ends_at)
SELECT n,n+1800000 FROM (SELECT floor(extract(epoch from clock_timestamp())*1000)::bigint n) t;
ALTER TABLE her_private.burn_intents ADD COLUMN round_id bigint REFERENCES her_private.character_rounds(id);
ALTER TABLE her_private.burn_receipts ADD COLUMN counted boolean NOT NULL DEFAULT false;
CREATE INDEX vote_intent_round ON her_private.burn_intents(round_id);
CREATE INDEX pending_burn_signature ON her_private.burn_intents(created_at) WHERE submitted_signature IS NOT NULL;
REVOKE ALL ON her_private.character_control,her_private.character_rounds FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON her_private.character_control,her_private.character_rounds TO her_web;
ALTER TABLE her_private.character_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE her_private.character_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY her_server_access ON her_private.character_control TO her_web USING(true) WITH CHECK(true);
CREATE POLICY her_server_access ON her_private.character_rounds TO her_web USING(true) WITH CHECK(true);

CREATE FUNCTION her_private.advance_character_rounds() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r record; c record; n bigint; top_total numeric; tied integer; pick text;
BEGIN
 SELECT * INTO c FROM her_private.character_control WHERE id=1 FOR UPDATE;
 n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 FOR r IN SELECT * FROM her_private.character_rounds WHERE settled_at IS NULL AND ends_at<=n ORDER BY id FOR UPDATE LOOP
  WITH totals AS (SELECT i.character,sum(b.amount::numeric) total FROM her_private.burn_receipts b JOIN her_private.burn_intents i ON i.id=b.id WHERE i.round_id=r.id AND b.counted GROUP BY i.character)
  SELECT max(total) INTO top_total FROM totals;
  SELECT count(*),min(character) INTO tied,pick FROM (
   SELECT i.character,sum(b.amount::numeric) total FROM her_private.burn_receipts b JOIN her_private.burn_intents i ON i.id=b.id WHERE i.round_id=r.id AND b.counted GROUP BY i.character
  ) t WHERE total=top_total;
  IF tied=1 AND top_total>0 THEN
   UPDATE her_private.character_control SET desired=pick,revision=revision+1 WHERE id=1;
   c.desired:=pick;
  END IF;
  UPDATE her_private.character_rounds SET settled_at=n,winner=c.desired,reason=CASE WHEN top_total IS NULL THEN 'no_votes' WHEN tied>1 THEN 'tie' ELSE 'most_burned' END WHERE id=r.id;
  INSERT INTO her_private.character_rounds(id,ends_at) VALUES(r.ends_at,r.ends_at+1800000) ON CONFLICT DO NOTHING;
 END LOOP;
 -- Advance across long downtime without generating thousands of empty rounds.
 SELECT * INTO r FROM her_private.character_rounds WHERE settled_at IS NULL ORDER BY id DESC LIMIT 1;
 IF r.ends_at<=n THEN
  UPDATE her_private.character_rounds SET settled_at=n,winner=c.desired,reason='no_votes' WHERE id=r.id;
  n:=r.id+floor((n-r.id)::numeric/1800000)::bigint*1800000;
  INSERT INTO her_private.character_rounds(id,ends_at) VALUES(n,n+1800000) ON CONFLICT DO NOTHING;
 END IF;
END $$;
REVOKE ALL ON FUNCTION her_private.advance_character_rounds() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION her_private.advance_character_rounds() TO her_web;

-- Serialize receipt acceptance and round settlement on the same control row.
CREATE FUNCTION her_private.accept_character_burn(intent_id text,sign text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i record; r record; n bigint; eligible boolean;
BEGIN
 PERFORM 1 FROM her_private.character_control WHERE id=1 FOR UPDATE;
 SELECT * INTO i FROM her_private.burn_intents WHERE id=intent_id;
 IF NOT FOUND OR i.kind<>'character' OR i.round_id IS NULL THEN RAISE EXCEPTION 'Invalid vote intent'; END IF;
 SELECT * INTO r FROM her_private.character_rounds WHERE id=i.round_id;
 n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 eligible:=r.settled_at IS NULL AND n<r.ends_at;
 INSERT INTO her_private.burn_receipts(id,wallet,kind,character,amount,signature,created_at,counted)
 VALUES(i.id,i.wallet,i.kind,i.character,i.amount,sign,n,eligible) ON CONFLICT(id) DO NOTHING;
 RETURN (SELECT counted FROM her_private.burn_receipts WHERE id=i.id AND signature=sign);
END $$;
REVOKE ALL ON FUNCTION her_private.accept_character_burn(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION her_private.accept_character_burn(text,text) TO her_web;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('her-character-rounds','10 seconds','SELECT her_private.advance_character_rounds()');
