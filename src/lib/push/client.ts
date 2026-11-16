import type { ServerWake } from "./schedule";

/**
 * El cliente de la ruta de avisos (el puente aparato ↔ servicio, regla 19). Lo único que pone
 * en la red: la dirección de push de este teléfono, su huso, horas SIN etiqueta (minuto del día
 * y días de la semana), el día y minuto que se saltan, y los tokens en el encabezado. Jamás un
 * nombre, un alimento, un suplemento ni una nota. El `fetch` se inyecta: las pruebas ponen un
 * centinela delante y revisan cada cuerpo que sale.
 */

export const PUSH_API = "/api/push";

export type PushApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export type FamilyProof = { code: string; token: string } | null;

export type PushApi = ReturnType<typeof pushApi>;

export function pushApi(
  fetcher: typeof fetch = (...a) => fetch(...a),
  base = PUSH_API,
) {
  async function post<T>(
    op: string,
    body: Record<string, unknown> | null,
    token?: string,
  ): Promise<PushApiResult<T>> {
    let res: Response;
    try {
      res = await fetcher(`${base}/${op}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
        cache: "no-store",
        credentials: "omit",
      });
    } catch {
      return { ok: false, status: 0, error: "offline" };
    }
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.ok) return { ok: true, status: res.status, data: json };
    return { ok: false, status: res.status, error: json.error ?? "error" };
  }

  return {
    health: () =>
      post<{ available: boolean; store: string; key: string | null }>(
        "health",
        null,
      ),
    subscribe: (body: {
      endpoint: string;
      token: string;
      tz: string;
      wakes: ServerWake[];
      family: FamilyProof;
    }) => post<{ id: string }>("subscribe", body),
    update: (
      token: string,
      body: {
        id: string;
        endpoint: string;
        tz: string;
        wakes: ServerWake[];
        family: FamilyProof;
      },
    ) => post<{ ok: true }>("update", body, token),
    skip: (
      token: string,
      body: { id: string; date: string; m: number; on: boolean },
    ) => post<{ ok: true }>("skip", body, token),
    unsubscribe: (token: string, id: string) =>
      post<{ ok: true }>("unsubscribe", { id }, token),
    /** Despierta a los otros teléfonos de la familia (el servidor no sabe qué hay en el aviso). */
    family: (familyToken: string, family: string, from: string | null) =>
      post<{ sent: number }>("family", { family, from }, familyToken),
  };
}
