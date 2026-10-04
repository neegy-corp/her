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
import { streamCreditsEnabled, requireVideoCredit } from "@/lib/stream-credit-store";
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
      if(body.mode!=="script" || body.messages.length) return json({error:"Chat-driven generation has been removed. Use a creator script or prompt."},400);
      const row = await ownedDraft(body.id, who);
      if (!row)
        return json(
          { error: "Save this character to your wallet first." },
          404,
        );
      const parsed = mediaDraftSchema.safeParse(JSON.parse(row.document));
      if (!parsed.success) throw new Error("Add a character name and check the creative prompts before writing scenes. A coin ticker is not needed yet.");
      const draft = parsed.data;
      if (!draft.rightsConfirmed)
        throw new Error("Confirm character rights first.");
      if (streamCreditsEnabled()) await requireVideoCredit(body.id,who);
      await takeQuota(`script:${who}`, streamCreditsEnabled() ? 600 : 100);
      const result = await generateScene(scriptMessages(draft, "script", body.brief, []));
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
