# Continuous operation

Start the local studio from this directory with `node scripts/run-studio.mjs`.
The supervisor restarts a crashed studio process after five seconds. Stop the
supervisor and its child process when intentionally shutting down the studio.
This is a local process supervisor, not Windows boot recovery.

The OBS browser source uses `http://127.0.0.1:5173/?camera=1`. The camera retries
failed starts and disconnections indefinitely, backing off from two to thirty
seconds. Explicitly ending the live session still cancels recovery. Transport
operations have deadlines so a hung request cannot strand the retry loop.

Individual Tavus calls remain capped at ten minutes. The studio prepares a
replacement at eight and a half minutes and retires the old call after the new
video is ready. This is session rotation, not an overall stream stop timer.
Conversation history, character identity and voice selection survive rotation.

OBS profile HER Test has automatic reconnect enabled, a two-second retry delay
and 9,999 maximum retries. Its automatic output stop timer is disabled.

The computer, OBS, internet connection and provider account must remain
available. Provider outages, exhausted account credit, host shutdowns and OBS
crashes can still interrupt the public stream. No automatic purchases or
provider account changes are made by recovery.
