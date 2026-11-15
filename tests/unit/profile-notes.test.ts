import { describe, expect, it, vi } from "vitest";
import type { ErrorEvent, NodeOptions } from "@sentry/nextjs";

type TransactionEvent = Parameters<
  NonNullable<NodeOptions["beforeSendTransaction"]>
>[0];

import demoRaw from "../../data/demo-diet.json";
import v1Raw from "../fixtures/diet-v1.json";
import { log } from "@/lib/log";
import {
  PROFILE_NOTES_KEY,
  PROFILE_NOTE_MAX,
  addProfileNote,
  loadProfileNotes,
  removeProfileNote,
  toggleTexture,
} from "@/lib/diet/profile-notes";
import { dietPlanSchema } from "@/lib/diet/schema";
import {
  STORAGE_KEYS,
  clearAllData,
  importDiet,
  loadActiveDiet,
} from "@/lib/diet/storage";
import {
  REDACTED,
  scrubSentryEvent,
  scrubSentryTransaction,
  scrubUrl,
  sensitiveTerms,
} from "@/lib/privacy/sentry-scrub";

const NOW = new Date("2026-07-06T09:00:00");
const demo = dietPlanSchema.parse(demoRaw);

describe("anotaciones de quien cuida (aparte del plan)", () => {
  it("amanece vacío y guarda texturas en el orden de la lista cerrada", () => {
    expect(loadProfileNotes()).toEqual({ acceptedTextures: [], notes: [] });
    toggleTexture("crunchy");
    toggleTexture("soft");
    expect(loadProfileNotes().acceptedTextures).toEqual(["soft", "crunchy"]);
    toggleTexture("soft");
    expect(loadProfileNotes().acceptedTextures).toEqual(["crunchy"]);
  });

  it("anota con fecha; vacío o demasiado largo no se guarda; se puede quitar", () => {
    const r = addProfileNote("allergy", "  Ejemplo de alergia  ", NOW);
    expect(r?.notes[0]).toMatchObject({
      kind: "allergy",
      text: "Ejemplo de alergia",
      at: "2026-07-06",
    });
    expect(addProfileNote("other", "   ", NOW)).toBeNull();
    expect(
      addProfileNote("other", "x".repeat(PROFILE_NOTE_MAX + 1), NOW),
    ).toBeNull();
    const id = loadProfileNotes().notes[0].id;
    expect(removeProfileNote(id).notes).toEqual([]);
  });

  it("un dato corrupto se descarta entero, no se adivina", () => {
    localStorage.setItem(PROFILE_NOTES_KEY, "{roto");
    expect(loadProfileNotes().notes).toEqual([]);
    localStorage.setItem(
      PROFILE_NOTES_KEY,
      JSON.stringify({ acceptedTextures: ["gomosa"], notes: [] }),
    );
    expect(loadProfileNotes().acceptedTextures).toEqual([]);
  });

  it("sobreviven a cargar un plan nuevo y «Borrar datos» las elimina", () => {
    addProfileNote("medication", "Ejemplo anotado", NOW);
    toggleTexture("puree");
    expect(importDiet(JSON.stringify(demoRaw)).ok).toBe(true);
    expect(loadProfileNotes().notes).toHaveLength(1);
    expect(loadProfileNotes().acceptedTextures).toEqual(["puree"]);
    clearAllData();
    expect(localStorage.getItem(PROFILE_NOTES_KEY)).toBeNull();
  });
});

describe("un plan v1 guardado se migra al leer, sin perderse", () => {
  it("se lee como v2 y se reescribe en v2 ya validado", () => {
    localStorage.setItem(STORAGE_KEYS.diet, JSON.stringify(v1Raw));
    localStorage.setItem(STORAGE_KEYS.source, "real");
    const active = loadActiveDiet();
    expect(active.source).toBe("real");
    expect(active.diet.schemaVersion).toBe(2);
    expect(active.diet.meta.id).toBe(v1Raw.meta.id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.diet) ?? "{}");
    expect(stored.schemaVersion).toBe(2);
    // Segunda lectura: ya es v2, sigue siendo el mismo plan.
    expect(loadActiveDiet().diet).toEqual(active.diet);
  });

  it("importar un v1 lo acepta y lo guarda en v2", () => {
    expect(importDiet(JSON.stringify(v1Raw)).ok).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.diet) ?? "{}");
    expect(stored.schemaVersion).toBe(2);
  });

  it("si no se puede reescribir en v2 (cuota llena), igual devuelve el plan migrado", () => {
    localStorage.setItem(STORAGE_KEYS.source, "real");
    localStorage.setItem(STORAGE_KEYS.diet, JSON.stringify(v1Raw));
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const active = loadActiveDiet();
    spy.mockRestore();
    expect(active.source).toBe("real");
    expect(active.diet.schemaVersion).toBe(2);
  });
});

describe("el perfil no sale del teléfono: ni logs ni Sentry", () => {
  const SENSITIVE = [
    "Mariscos",
    "Shellfish",
    "Sorbitol",
    "Medicamento demo",
    "Condición de ejemplo",
  ];

  it("importar, leer y borrar solo loguean metadatos", () => {
    const lines: string[] = [];
    for (const level of ["info", "warn", "error", "debug"] as const)
      vi.spyOn(log, level).mockImplementation((...args: unknown[]) => {
        lines.push(JSON.stringify(args));
      });
    addProfileNote("allergy", "Anotación privada de prueba", NOW);
    importDiet(JSON.stringify(demoRaw));
    localStorage.setItem(STORAGE_KEYS.diet, JSON.stringify(v1Raw));
    loadActiveDiet();
    clearAllData();
    vi.restoreAllMocks();
    expect(lines.length).toBeGreaterThan(0);
    const all = lines.join("\n");
    for (const term of [...SENSITIVE, "Anotación privada"])
      expect(all).not.toContain(term);
  });

  it("sensitiveTerms junta perfil del plan y anotaciones", () => {
    const terms = sensitiveTerms(demo, {
      acceptedTextures: [],
      notes: [
        { id: "a", kind: "other", text: "Nota privada", at: "2026-07-06" },
      ],
    });
    for (const t of [
      "Mariscos",
      "Shellfish",
      "Sorbitol",
      "Medicamento demo",
      "Nota privada",
    ])
      expect(terms).toContain(t);
    expect(sensitiveTerms(null, null)).toEqual([]);
  });

  it("el evento de Sentry pierde extra, usuario, cuerpo y breadcrumbs de consola, y tapa los términos", () => {
    const event = {
      type: undefined,
      message: "falló al leer Medicamento demo",
      extra: { profile: "Mariscos" },
      user: { id: "x" },
      request: { url: "/perfil", data: "Sorbitol" },
      breadcrumbs: [
        { category: "console", message: "Mariscos" },
        { category: "ui.input", message: "algo" },
        {
          category: "navigation",
          message: "/perfil",
          data: { to: "Sorbitol" },
        },
      ],
      exception: {
        values: [
          { type: "Error", value: "no hay Shellfish aquí" },
          { type: "Error", value: "TypeError genérico" },
        ],
      },
    } as unknown as ErrorEvent;
    const out = scrubSentryEvent(event, sensitiveTerms(demo, null));
    expect(out.extra).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.url).toBe("/perfil");
    expect(out.message).toBe(REDACTED);
    expect(out.breadcrumbs).toEqual([
      { category: "navigation", message: "/perfil", data: undefined },
    ]);
    expect(out.exception?.values?.map((v) => v.value)).toEqual([
      REDACTED,
      "TypeError genérico",
    ]);
    const serialized = JSON.stringify(out);
    for (const term of SENSITIVE) expect(serialized).not.toContain(term);
  });

  it("sin mensaje ni excepción, el evento pasa sin romperse", () => {
    const out = scrubSentryEvent({ type: undefined } as ErrorEvent, []);
    expect(out).toEqual({ type: undefined });
  });
});

describe("no existe un camino de export que pueda llevarse el perfil", () => {
  it("src/ no fabrica descargas (Blob, createObjectURL, download)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const hits = walk("src")
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) =>
        /new Blob\(|createObjectURL|\bdownload=|navigator\.share\(/.test(
          readFileSync(f, "utf-8"),
        ),
      );
    // Si algún día nace un export (S7+), este test obliga a decidir qué lleva: el perfil NO.
    expect(hits).toEqual([]);
  });
});

describe("auditoría S5: la URL y las transacciones tampoco llevan contenido", () => {
  it("scrubUrl quita consulta, ancla, host e id del alimento", () => {
    expect(scrubUrl("https://x.test/dieta/mariscos?q=1#a")).toBe("/dieta/:id");
    expect(scrubUrl("/perfil?nota=Sorbitol")).toBe("/perfil");
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it("el evento de error sale sin consulta, cabeceras, etiquetas ni contextos", () => {
    const out = scrubSentryEvent(
      {
        request: {
          url: "/dieta/mariscos?q=1",
          query_string: "q=1",
          headers: { a: "b" },
        },
        tags: { x: "1" },
        contexts: { c: {} },
      } as unknown as ErrorEvent,
      [],
    );
    expect(out.request?.url).toBe("/dieta/:id");
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.tags).toBeUndefined();
    expect(out.contexts).toBeUndefined();
  });

  it("la transacción pierde extra, usuario, migas y datos de spans, y tapa términos", () => {
    const out = scrubSentryTransaction(
      {
        type: "transaction",
        transaction: "/dieta/mariscos",
        extra: { a: 1 },
        user: { id: "x" },
        request: { url: "/dieta/mariscos?q=1", headers: { a: "b" } },
        breadcrumbs: [{ message: "x" }],
        spans: [
          { description: "GET /dieta/mariscos", data: { q: "Sorbitol" } },
          { description: "leyó Sorbitol", data: {} },
        ],
      } as unknown as TransactionEvent,
      ["Sorbitol"],
    );
    expect(out.transaction).toBe("/dieta/:id");
    expect(out.extra).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.request?.url).toBe("/dieta/:id");
    expect(out.spans?.[0].data).toEqual({});
    expect(out.spans?.[0].description).toBe("GET /dieta/:id");
    expect(out.spans?.[1].description).toBe(REDACTED);
  });
});
