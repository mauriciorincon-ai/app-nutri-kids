import { handlePush } from "@/lib/push/server/handler";
import { pushDeps } from "@/lib/push/server/deps";
import { MAX_BODY } from "@/lib/push/server/limits";

/**
 * La ruta de los avisos (S8 · ADR-012): guarda horas sin etiqueta y envía toques vacíos.
 * Nada de esta ruta se registra: ni cuerpos, ni encabezados, ni direcciones de envío.
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
  const out = await handlePush(
    {
      op: op.join("/"),
      method: req.method,
      body,
      authorization: req.headers.get("authorization"),
      signature: req.headers.get("upstash-signature"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    },
    await pushDeps(process.env),
  );
  return Response.json(out.json, { status: out.status, headers });
}

export const GET = run;
export const POST = run;
