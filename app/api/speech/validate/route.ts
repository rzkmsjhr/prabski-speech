import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const expected = (env as unknown as { ADMIN_KEY?: string }).ADMIN_KEY;
  const supplied = request.headers.get("x-admin-key");
  if (!expected || !supplied || supplied !== expected) {
    return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
