ALTER TABLE her_private.launchpad_renders DROP CONSTRAINT launchpad_renders_provider_check;
ALTER TABLE her_private.launchpad_renders ADD CONSTRAINT launchpad_renders_provider_check CHECK (provider IN ('tavus','fal','higgsfield'));
