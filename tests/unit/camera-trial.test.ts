import { describe, expect, it } from "vitest";

import {
  PASS,
  shortAgent,
  summarize,
  trialText,
  verdict,
  type TrialMeta,
  type TrialPhoto,
} from "@/lib/camera/trial";

const META: TrialMeta = {
  engine: "webgpu",
  modelBytes: 160_400_000,
  runtimeBytes: 6_000_000,
  fromCache: false,
  loadMs: 41_200,
  agent: "Android 14 · Chrome 131",
};
const T = {
  title: "Prueba",
  engine: "Motor",
  size: "Tamaño",
  load: "Carga",
  perPhoto: "Por foto",
  max: "máx",
  hits: "Aciertos",
  invented: "Inventados",
  fromCache: "ya estaba",
  device: "Teléfono",
  photo: "Foto",
};

const photo = (ms: number, ...marks: ("yes" | "no" | null)[]): TrialPhoto => ({
  ms,
  seen: marks.map((mark, i) => ({ label: `cosa ${i}`, mark })),
});

describe("la prueba de la cámara", () => {
  it("cuenta aciertos por foto (≥ 1 ✓), inventados (✗) y sin marcar", () => {
    const s = summarize(
      [photo(3000, "yes", "no"), photo(5000, "no"), photo(4000, null), photo(1000)],
      META,
    );
    expect(s).toMatchObject({ photos: 4, hits: 1, invented: 2, unmarked: 1 });
    expect(s.medianMs).toBe(3500);
    expect(s.maxMs).toBe(5000);
    expect(s.totalMB).toBe(166.4);
  });

  it("sin fotos no hay veredicto de velocidad ni de completo", () => {
    const v = verdict(summarize([], META));
    expect(v.speed).toBe(false);
    expect(v.complete).toBe(false);
    expect(v.size).toBe(true);
  });

  it("pasa con 7 de 10, un inventado, ≤ 20 s y ≤ 200 MB; no pasa con dos inventados o una foto lenta", () => {
    const good = [
      ...Array.from({ length: 7 }, () => photo(8000, "yes")),
      photo(19_000, "no"),
      photo(6000, "yes"),
      photo(6000, "yes"),
    ];
    const v = verdict(summarize(good, META));
    expect(v).toEqual({ size: true, speed: true, hits: true, invented: true, complete: true });
    expect(verdict(summarize([...good.slice(0, 9), photo(6000, "no")], META)).invented).toBe(false);
    expect(verdict(summarize([...good.slice(0, 9), photo(PASS.maxSeconds * 1000 + 1, "yes")], META)).speed).toBe(false);
    expect(verdict(summarize(good, { modelBytes: 199e6, runtimeBytes: 2e6 })).size).toBe(false);
  });

  it("el texto copiado lleva motor, tamaños, tiempos y conteos — y nada de la foto", () => {
    const text = trialText([photo(3200, "yes", "no")], META, T);
    expect(text).toContain("Motor: WebGPU");
    expect(text).toContain("Tamaño: 166.4 MB");
    expect(text).toContain("Carga: 41.2 s");
    expect(text).toContain("Por foto: 3.2 s (máx 3.2 s)");
    expect(text).toContain("Aciertos: 1/1");
    expect(text).toContain("Foto 1 · 3.2 s · ✓ cosa 0, ✗ cosa 1");
    expect(text).not.toMatch(/data:|blob:|base64/);
    expect(trialText([], { ...META, fromCache: true, engine: "wasm" }, T)).toContain("WASM");
    expect(trialText([], { ...META, fromCache: true }, T)).toContain("(ya estaba)");
  });

  it("el navegador se resume en sistema · navegador", () => {
    expect(
      shortAgent("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"),
    ).toBe("Android 14 · Chrome 131");
    expect(
      shortAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),
    ).toBe("iOS 18.1 · Safari 18");
    expect(shortAgent("algo raro")).toBe("? · ?");
  });
});
