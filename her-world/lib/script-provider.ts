import { setting } from "./server";

export const scriptProviderReady = () =>
  Boolean(setting("ANTHROPIC_API_KEY") || setting("OPENAI_API_KEY"));

/** Server-only provider boundary. Never retry a paid request through a second provider. */
export async function generateScene(messages: { role: string; content: string }[]) {
  const anthropic = Boolean(setting("ANTHROPIC_API_KEY"));
  const response = await fetch(
    anthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: anthropic
        ? { "x-api-key": setting("ANTHROPIC_API_KEY").trim(), "anthropic-version": "2023-06-01", "Content-Type": "application/json" }
        : { Authorization: `Bearer ${setting("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(anthropic ? {
        model: setting("ACP_SCRIPT_MODEL") || "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: messages.filter(m => m.role === "system").map(m => m.content).join("\n") + " Return only the JSON object without markdown or commentary.",
        messages: messages.filter(m => m.role !== "system"),
        tools: [{ name: "write_scene", description: "Return the finished short scene.", input_schema: {
          type: "object", properties: { title: { type: "string", maxLength: 60 }, script: { type: "string", maxLength: 180 }, direction: { type: "string", maxLength: 500 }, duration: { type: "integer", enum: [5, 10, 15] } }, required: ["title", "script", "direction", "duration"], additionalProperties: false,
        } }],
        tool_choice: { type: "tool", name: "write_scene", disable_parallel_tool_use: true },
      } : {
        model: setting("ACP_SCRIPT_MODEL") || "gpt-4.1-mini",
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error("The script provider is unavailable. Check its billing and access.");
  const result = await response.json() as {
    stop_reason?: string;
    content?: { type: string; name?: string; input?: unknown }[];
    choices?: { message?: { content?: string } }[];
  };
  if (anthropic) {
    const blocks = result.content?.filter((part: { type: string; name?: string }) => part.type === "tool_use" && part.name === "write_scene");
    if (result.stop_reason !== "tool_use" || blocks?.length !== 1 || !blocks[0].input)
      throw new Error("The script provider did not finish a usable scene.");
    return blocks[0].input;
  }
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content || content.length > 5000)
    throw new Error("The script provider did not return a usable scene.");
  try { return JSON.parse(content); }
  catch { throw new Error("The generated script did not pass validation. Your show is unchanged."); }
}
