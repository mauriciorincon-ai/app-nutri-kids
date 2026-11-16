import { handle } from "@/lib/family/server/handler";
import { MAX_BODY } from "@/lib/family/server/limits";
import { selectStore } from "@/lib/family/server/store";

/**
 * La única ruta de servidor de la app (S7 · ADR-011): guarda lo que la familia comparte,
 * ya cifrado en el aparato. Nada de esta ruta se registra: ni cuerpos, ni encabezados, ni
 * códigos. Todo va por POST con el código en el cuerpo, para que no quede en una URL.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ op: string[] }> };

async function run(req: Request, ctx: Ctx): Promise<Response> {
  const { op } = await ctx.params;
  const headers = { "cache-control": "no-store" };
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) {
    return Response.json({ error: "too-large" }, { status: 413, headers });
  }
  const body = req.method === "POST" ? await req.text() : "";
  const out = await handle(
    {
      op: op.join("/"),
      method: req.method,
      body,
      authorization: req.headers.get("authorization"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    },
    selectStore(process.env),
  );
  return Response.json(out.json, { status: out.status, headers });
}

export const GET = run;
export const POST = run;
