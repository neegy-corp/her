import { withDatabase } from "@/lib/database";
import { publicTokenRows } from "@/lib/launchpad-store";
import { publicToken } from "@/lib/public-tokens";
import { setting, json } from "@/lib/server";
import { archivedCharacterIds } from "@/lib/character-visibility";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("offset") || "0";
  if (!/^\d{1,6}$/.test(raw)) return json({ error: "Invalid page." }, 400);
  const offset = Number(raw);
  if (!setting("DATABASE_URL") && process.env.NODE_ENV === "development")
    return json({ tokens: [], nextOffset: null, configured: false });
  if (!setting("DATABASE_URL"))
    return json(
      { error: "The token directory is temporarily unavailable." },
      503,
    );
  try {
    return await withDatabase(setting("DATABASE_URL"), async () => {
      const rows = await publicTokenRows(offset);
      const archived = archivedCharacterIds();
      return json(
        {
          tokens: rows.slice(0, 24).filter(row => !archived.has(row.id)).map(publicToken).filter(Boolean),
          nextOffset: rows.length > 24 ? offset + 24 : null,
        },
        200,
        { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
      );
    });
  } catch {
    return json(
      {
        error: "The token directory is temporarily unavailable. Please retry.",
      },
      503,
    );
  }
}
