import type { WireRecord } from "./records";

/**
 * El cliente de la ruta de la familia (el puente aparato ↔ servicio, regla 19). Lo único
 * que pone en la red: el código de la familia, la sal, el token (en el encabezado) y
 * registros ya cifrados. El `fetch` se inyecta: las pruebas ponen un centinela delante y
 * revisan cada cuerpo que sale.
 */

export const FAMILY_API = "/api/family";

export type ServerRecord = WireRecord & { ver: number; seq: number };
export type PushResult = {
  id: string;
  status: "ok" | "conflict" | "full";
  ver: number;
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: T };

export type FamilyApi = ReturnType<typeof familyApi>;

export function familyApi(
  fetcher: typeof fetch = (...a) => fetch(...a),
  base = FAMILY_API,
) {
  async function post<T>(
    op: string,
    body: Record<string, unknown> | null,
    token?: string,
  ): Promise<ApiResult<T>> {
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
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "error",
      data: json,
    };
  }

  return {
    health: () =>
      post<{ available: boolean; store: "real" | "memory" | "none" }>(
        "health",
        null,
      ),
    create: (family: string, salt: string, token: string) =>
      post<{ epoch: number }>("create", { family, salt, token }),
    join: (family: string) =>
      post<{ salt: string; epoch: number }>("join", { family }),
    pull: (family: string, epoch: number, since: number, token: string) =>
      post<{ seq: number; more: boolean; records: ServerRecord[] }>(
        "pull",
        { family, epoch, since },
        token,
      ),
    push: (
      family: string,
      epoch: number,
      records: (WireRecord & { ver: number })[],
      token: string,
    ) =>
      post<{ results: PushResult[] }>(
        "push",
        { family, epoch, records },
        token,
      ),
    rotate: (
      family: string,
      epoch: number,
      salt: string,
      newToken: string,
      token: string,
    ) =>
      post<{ epoch: number }>(
        "rotate",
        { family, epoch, salt, token: newToken },
        token,
      ),
    destroy: (family: string, token: string) =>
      post<{ ok: true }>("destroy", { family }, token),
  };
}
