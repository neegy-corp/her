import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  defaultShow,
  initialShow,
  startShow,
  queueChat,
  nextChat,
  acknowledgeChat,
  clipEnded,
  tickShow,
  generationCompleted,
  generationFailed,
  compileSuggestions,
} from "../lib/show.ts";
const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL(specifier.slice(2), root).href;
    if (
      (specifier.startsWith(".") || specifier.startsWith("file:")) &&
      context.parentURL?.startsWith(root.href)
    ) {
      const url = new URL(specifier, context.parentURL);
      if (
        !url.pathname.endsWith(".ts") &&
        existsSync(fileURLToPath(`${url.href}.ts`))
      )
        specifier = `${url.href}.ts`;
    }
    return next(specifier, context);
  },
});
const { newDraft, draftSchema, localDraftSchema, visualFingerprint } =
  await import("../lib/launchpad.ts");
const { imageType, performanceInput, safeVideoUrl } = await import(
  "../lib/launchpad-media.ts"
);
const route = await import("../app/api/launchpad/route.ts");
const videos = await import("../app/api/launchpad/videos/route.ts");
const assets = await import("../app/api/launchpad/assets/route.ts");
const plan = () => ({ ...defaultShow(), chatWindow: 15, maxGenerations: 1 });
test("unfinished local drafts survive autosave without passing launch validation", () => {
  const draft = { ...newDraft(), name: "", symbol: "", appearance: "" };
  assert.equal(localDraftSchema.safeParse(draft).success, true);
  assert.equal(draftSchema.safeParse(draft).success, false);
});
test("visual approval changes with background or appearance", () => {
  const d = newDraft();
  assert.notEqual(
    visualFingerprint(d),
    visualFingerprint({ ...d, background: "A completely different room" }),
  );
});
test("show cannot start until every scripted clip is rendered", () => {
  const p = plan();
  assert.throws(() => startShow(p, new Set([p.clips[0].id])));
  assert.equal(
    startShow(p, new Set(p.clips.map((c) => c.id))).activeClip,
    p.clips[0].id,
  );
});
test("chat waits for the pause and finishes speaking before the next clip", () => {
  const p = plan();
  let s = startShow(p, new Set(p.clips.map((c) => c.id)));
  s = queueChat(s, { id: "1", author: "Jo", text: "Hello!", at: 1000 }, 1000);
  assert.equal(nextChat(s, 1000, false), null);
  s = clipEnded(s, p, p.clips[0].id, 2000);
  assert.equal(nextChat(s, 3000, true), null);
  assert.equal(nextChat(s, 3000, false).author, "Jo");
  s = acknowledgeChat(s, "1");
  assert.equal(nextChat(s, 3000, false), null);
  assert.equal(s.messages.length, 1);
  assert.equal(tickShow(s, p, 50000, true).phase, "chat");
  assert.equal(tickShow(s, p, 50000, false).activeClip, p.clips[1].id);
});
test("duplicate ended events cannot skip a clip or extend a pause", () => {
  const p = plan();
  let s = startShow(p, new Set(p.clips.map((c) => c.id)));
  s = clipEnded(s, p, p.clips[0].id, 1000);
  assert.deepEqual(clipEnded(s, p, p.clips[0].id, 2000), s);
});
test("only generate after the whole script and enforce the configured cap", () => {
  const p = plan();
  p.clips.forEach((c) => (c.chatPause = 0));
  let s = startShow(p, new Set(p.clips.map((c) => c.id)));
  s = queueChat(s, { id: "a", author: "A", text: "Dance", at: 1 }, 1);
  s = tickShow(clipEnded(s, p, p.clips[0].id, 2), p, 2);
  assert.equal(s.phase, "playing");
  s = tickShow(clipEnded(s, p, p.clips[1].id, 3), p, 3);
  assert.equal(s.phase, "collecting");
  s = tickShow(s, p, 16000);
  assert.equal(s.phase, "generating");
  s = generationCompleted(s, "generated-one");
  assert.equal(s.generated, 1);
  s = tickShow(clipEnded(s, p, "generated-one", 17000), p, 17000);
  assert.equal(s.phase, "finished");
});
test("idle chat waits rather than buying endless generated clips", () => {
  const p = plan();
  let s = { ...initialShow(), phase: "collecting", deadline: 1000 };
  s = tickShow(s, p, 2000);
  assert.equal(s.phase, "waiting");
  assert.equal(tickShow(s, p, 5000).phase, "waiting");
  s = queueChat(s, { id: "a", author: "A", text: "A dance", at: 5001 }, 5001);
  assert.equal(tickShow(s, p, 5002).phase, "collecting");
});
test("stale chat, duplicate events and sender spam are bounded", () => {
  let s = initialShow();
  s = queueChat(s, { id: "old", author: "A", text: "Old", at: 1 }, 130000);
  assert.equal(s.messages.length, 0);
  for (let i = 0; i < 8; i++)
    s = queueChat(
      s,
      { id: String(i), author: "A", text: "dance", at: 150000 },
      150000,
    );
  assert.equal(s.messages.length, 3);
  assert.deepEqual(
    queueChat(s, { id: "1", author: "A", text: "again", at: 150000 }, 150000),
    s,
  );
  assert.equal(compileSuggestions(s.messages)[0].votes, 1);
});
test("failed generation does not immediately retry a paid provider", () => {
  const s = generationFailed({
    ...initialShow(),
    phase: "generating",
    messages: [{ id: "a", author: "A", text: "Dance", at: 1 }],
  });
  assert.equal(s.phase, "waiting");
  assert.equal(s.messages.length, 0);
});
test("server rejects SVG and mismatched image bytes", () => {
  assert.equal(
    imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    null,
  );
  assert.equal(
    imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])).mime,
    "image/png",
  );
  assert.equal(safeVideoUrl("javascript:alert(1)"), null);
  assert.equal(safeVideoUrl("https://user:password@example.com/file"), null);
});
test("motion request preserves selected image, duration and dialogue", () => {
  const c = defaultShow().clips[1],
    input = performanceInput(c, ["https://example.com/face.png"]);
  assert.equal(input.start_image_url, "https://example.com/face.png");
  assert.equal(input.duration, "10");
  assert.ok(input.prompt.includes(c.script));
});
test("disabled storage and unauthenticated jobs cannot invoke paid providers", async () => {
  process.env.HER_LAUNCHPAD_ENABLED = "false";
  const status = await (
    await route.GET(new Request("http://localhost/api/launchpad"))
  ).json();
  assert.equal(status.storage, false);
  assert.equal(status.broadcast, false);
  for (const handler of [videos.POST, assets.POST]) {
    const response = await handler(
      new Request("http://localhost/api/launchpad/videos", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 401);
  }
});
