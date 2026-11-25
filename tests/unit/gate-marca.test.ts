// kit v2.5.0 — regla 10. Demo en rojo del gate de marca: habría bloqueado el PR #4 de AI-Jobs (2026-11-23), donde
// design-system.md y 23 pantallas llegaron sin que el dueño viera la marca.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { esDisenoConstruido, evaluar, PAGINA_MARCA, REGISTRO } from "../../scripts/gate-marca.mjs";

const MARCA_HTML = "<!doctype html><title>Marca</title><p>Tres direcciones aplicadas a la pantalla de inicio</p>\n";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

function repo(archivos: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "gate-marca-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [ruta, texto] of Object.entries(archivos)) {
    mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    writeFileSync(join(dir, ruta), texto);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

const registro = (campos: Record<string, string>) =>
  `---\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# Marca\n`;

const aprobada = (extra: Record<string, string> = {}) =>
  registro({
    estado: "aprobada",
    aprobada_el: "2026-11-23",
    direccion: "B",
    frase_del_dueno: '"me quedo con la B, con el azul más oscuro"',
    marca_sha256: sha(MARCA_HTML),
    ...extra,
  });

describe("gate-marca (regla 10)", () => {
  it("sin diseño construido pasa (el estampado y los spikes no lo necesitan)", () => {
    expect(evaluar(repo({ "README.md": "x\n", "docs/seguridad/MODELO-DE-AMENAZAS.md": "x\n" })).ok).toBe(true);
  });

  it("la página de marca sola pasa: es lo que el dueño mira antes", () => {
    expect(evaluar(repo({ [PAGINA_MARCA]: MARCA_HTML, "docs/diseno/marca/b.css": "x\n" })).ok).toBe(true);
  });

  it("habría bloqueado el PR #4 de AI-Jobs: design-system.md y pantallas sin registro", () => {
    const r = evaluar(repo({ "design-system.md": "# DS\n", "docs/diseno/01-inicio.html": "<p>x</p>\n" }));
    expect(r.ok).toBe(false);
    expect(r.razon).toContain(`falta ${REGISTRO}`);
    expect(r.disenos).toEqual(["design-system.md", "docs/diseno/01-inicio.html"]);
  });

  it("un registro sin aprobar, sin frase o con «continúa» bloquea", () => {
    const base = { "design-system.md": "# DS\n", [PAGINA_MARCA]: MARCA_HTML };
    expect(evaluar(repo({ ...base, [REGISTRO]: aprobada({ estado: "propuesta" }) })).razon).toContain("no está aprobada");
    expect(evaluar(repo({ ...base, [REGISTRO]: aprobada({ frase_del_dueno: '""' }) })).razon).toContain("frase_del_dueno");
    expect(evaluar(repo({ ...base, [REGISTRO]: aprobada({ frase_del_dueno: "«Continúa.»" }) })).razon).toContain("solo deja seguir");
    expect(evaluar(repo({ ...base, [REGISTRO]: aprobada({ direccion: "" }) })).razon).toContain("direccion");
  });

  it("si la página de marca cambia después de aprobarla, bloquea hasta otra mirada", () => {
    const r = evaluar(repo({ "design-system.md": "# DS\n", [PAGINA_MARCA]: MARCA_HTML + "<p>otra paleta</p>\n", [REGISTRO]: aprobada() }));
    expect(r.ok).toBe(false);
    expect(r.razon).toContain("marca_sha256 no coincide");
  });

  it("aprobada con su frase, su dirección y el hash de lo que vio: pasa", () => {
    const r = evaluar(repo({ "design-system.md": "# DS\n", "docs/diseno/01-inicio.html": "<p>x</p>\n", [PAGINA_MARCA]: MARCA_HTML, [REGISTRO]: aprobada() }));
    expect(r).toMatchObject({ ok: true, razon: null });
  });

  it("apps con G-Diseño anterior a la regla: «heredada» con su fecha pasa; sin fecha no", () => {
    const base = { "design-system.md": "# DS\n" };
    expect(evaluar(repo({ ...base, [REGISTRO]: registro({ estado: "heredada", g_diseno: "2026-09-27" }) })).ok).toBe(true);
    expect(evaluar(repo({ ...base, [REGISTRO]: registro({ estado: "heredada" }) })).razon).toContain("g_diseno");
  });

  it("clasifica qué es diseño construido", () => {
    expect(esDisenoConstruido("design-system.md")).toBe(true);
    expect(esDisenoConstruido("docs/diseno/12-tablero.html")).toBe(true);
    expect(esDisenoConstruido(PAGINA_MARCA)).toBe(false);
    expect(esDisenoConstruido("docs/diseno/marca/a.html")).toBe(false);
    expect(esDisenoConstruido("docs/diseno/README.md")).toBe(false);
    expect(esDisenoConstruido("src/app/page.tsx")).toBe(false);
  });
});
