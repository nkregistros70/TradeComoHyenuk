import { getMarketData } from "@/lib/quotes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "1";
    const data = await getMarketData({ force, refresh: true });
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market feed error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
