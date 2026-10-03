-- Longer shows retain the same owner checks and RLS; only the bounded document size changes.
ALTER TABLE her_private.launchpad_characters DROP CONSTRAINT launchpad_characters_document_check;
ALTER TABLE her_private.launchpad_characters ADD CONSTRAINT launchpad_characters_document_check CHECK (length(document) <= 96000);
