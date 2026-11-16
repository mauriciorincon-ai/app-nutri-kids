// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { pushApi } from "@/lib/push/client";
import { touchFamily } from "@/lib/push/touch";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe("el cliente de la ruta de avisos", () => {
  it("manda POST sin cookies ni caché, con el token en el encabezado y solo lo que se le da", async () => {
    const fetcher = vi.fn(async () => json(200, { ok: true }));
    const api = pushApi(fetcher as unknown as typeof fetch);
    await api.skip("T".repeat(43), {
      id: "i".repeat(22),
      date: "2026-11-16",
      m: 480,
      on: true,
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/push/skip");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "omit",
    });
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${"T".repeat(43)}`,
    );
    expect(JSON.parse(String(init.body))).toEqual({
      id: "i".repeat(22),
      date: "2026-11-16",
      m: 480,
      on: true,
    });
  });

  it("sin red da status 0; con error del servidor, su mensaje; sin cuerpo, «error»", async () => {
    const down = pushApi((async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch);
    expect(await down.health()).toEqual({
      ok: false,
      status: 0,
      error: "offline",
    });
    const bad = pushApi((async () =>
      json(403, { error: "denied" })) as unknown as typeof fetch);
    expect(await bad.unsubscribe("t", "i")).toEqual({
      ok: false,
      status: 403,
      error: "denied",
    });
    const empty = pushApi(
      (async () =>
        new Response("no json", { status: 500 })) as unknown as typeof fetch,
    );
    expect(await empty.health()).toEqual({
      ok: false,
      status: 500,
      error: "error",
    });
  });

  it("subscribe y update no llevan el token en el encabezado cuando es el alta, y family usa el token de la familia", async () => {
    const fetcher = vi.fn(async () => json(201, { id: "x", sent: 2 }));
    const api = pushApi(fetcher as unknown as typeof fetch);
    await api.subscribe({
      endpoint: "https://fcm.googleapis.com/fcm/send/a",
      token: "T".repeat(43),
      tz: "America/Bogota",
      wakes: [{ m: 480, d: 127 }],
      family: null,
    });
    const first = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(
      (first[1].headers as Record<string, string>).authorization,
    ).toBeUndefined();
    await api.family("F".repeat(43), "A1B2C3D4E5", null);
    const second = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(second[0]).toBe("/api/push/family");
    expect((second[1].headers as Record<string, string>).authorization).toBe(
      `Bearer ${"F".repeat(43)}`,
    );
  });

  it("touchFamily despierta a los demás: true si respondió, false si no", async () => {
    const ok = pushApi((async () =>
      json(200, { sent: 1 })) as unknown as typeof fetch);
    expect(await touchFamily("A1B2C3D4E5", "F".repeat(43), ok)).toBe(true);
    const no = pushApi((async () =>
      json(429, { error: "slow-down" })) as unknown as typeof fetch);
    expect(await touchFamily("A1B2C3D4E5", "F".repeat(43), no)).toBe(false);
  });
});
