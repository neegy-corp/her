import { withDatabase } from "@/lib/database";
import { wallet, mutationGuard, setting, json } from "@/lib/server";
import { ownedDraft, takeQuota } from "@/lib/launchpad-store";
import { fundedCreator } from "@/lib/launchpad-media";
import { mediaDraftSchema } from "@/lib/launchpad";
import { generateScene, scriptProviderReady } from "@/lib/script-provider";
import {
  scriptRequestSchema,
  scriptMessages,
  scriptToClip,
} from "@/lib/acp-script";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    return await withDatabase(setting("DATABASE_URL"), async () => {
      mutationGuard(req);
      const who = await wallet(req);
      if (!who)
        return json({ error: "Connect and verify your wallet first." }, 401);
      if (
        setting("HER_LAUNCHPAD_ENABLED") !== "true" ||
        setting("ACP_SCRIPTS_ENABLED") !== "true" ||
        !scriptProviderReady()
      )
        return json(
          {
            error:
              "AI script credits are not connected. Your written script is preserved.",
          },
          503,
        );
      fundedCreator(who);
      const raw = await req.text();
      if (raw.length > 26000) return json({ error: "Request too large." }, 413);
      const body = scriptRequestSchema.parse(JSON.parse(raw));
      const row = await ownedDraft(body.id, who);
      if (!row)
        return json(
          { error: "Save this character to your wallet first." },
          404,
        );
      const parsed = mediaDraftSchema.safeParse(JSON.parse(row.document));
      if (!parsed.success) throw new Error("Complete the character name, bio, appearance, personality and setting before writing scenes. A coin ticker is not needed yet.");
      const draft = parsed.data;
      if (!draft.rightsConfirmed)
        throw new Error("Confirm character rights first.");
      await takeQuota(`script:${who}`, 100);
      const messages = body.messages.filter(
        (m) => m.at >= Date.now() - 120000 && m.at <= Date.now() + 10000,
      );
      if (body.mode !== "script" && !messages.length)
        throw new Error("There are no fresh chat messages to respond to.");
      const result = await generateScene(scriptMessages(draft, body.mode, body.brief, messages));
      return json({
        clip: scriptToClip(result, body.mode),
        generated: true,
      });
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && !("issues" in error)
            ? error.message
            : "The generated script did not pass validation. Your show is unchanged.",
      },
      400,
    );
  }
}
