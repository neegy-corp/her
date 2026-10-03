import { withDatabase } from "@/lib/database";
import { wallet, mutationGuard, setting, json } from "@/lib/server";
import { ownedDraft, takeQuota } from "@/lib/launchpad-store";
import { fundedCreator } from "@/lib/launchpad-media";
import { draftSchema } from "@/lib/launchpad";
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
        !setting("OPENAI_API_KEY")
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
      const draft = draftSchema.parse(JSON.parse(row.document));
      if (!draft.rightsConfirmed)
        throw new Error("Confirm character rights first.");
      await takeQuota(`script:${who}`, 40);
      const messages = body.messages.filter(
        (m) => m.at >= Date.now() - 120000 && m.at <= Date.now() + 10000,
      );
      if (body.mode !== "script" && !messages.length)
        throw new Error("There are no fresh chat messages to respond to.");
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${setting("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: setting("ACP_SCRIPT_MODEL") || "gpt-4.1-mini",
            max_completion_tokens: 500,
            response_format: { type: "json_object" },
            messages: scriptMessages(draft, body.mode, body.brief, messages),
          }),
          signal: AbortSignal.timeout(45000),
          redirect: "error",
        },
      );
      if (!response.ok)
        throw new Error(
          "The script provider is unavailable. Check its billing and access.",
        );
      const result = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = result.choices?.[0]?.message?.content;
      if (!content || content.length > 5000)
        throw new Error("The script provider did not return a usable scene.");
      return json({
        clip: scriptToClip(JSON.parse(content), body.mode),
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
