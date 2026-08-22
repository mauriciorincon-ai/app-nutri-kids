import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Gate del contrato `brochure-export.json` (schema v1.0.0 del portafolio) + las dos
 * reglas duras que el brochure no puede romper: el CONTEO cuadrado contra el manual
 * y CERO enlaces de producción (regla 17).
 *
 * El test vigila la FORMA, no la vigencia: no puede saber si una cifra sigue siendo
 * cierta — por eso cada métrica se MIDE al generar el export, y el export se genera
 * de último en el PR.
 */

const raiz = resolve(__dirname, "../..");
const leer = (p: string) => readFileSync(resolve(raiz, p), "utf8");

const exportRaw = leer("docs/brochure-export.json");
type Metrica = {
  clave: string;
  valor: number;
  fuente: string;
  detalle: string;
};
type Feature = { nombre: string; que_hace: string; seccion_manual: string };
type Grupo = { features: Feature[] };
type Export = {
  _schema: Record<string, string>;
  schema_version: string;
  app: { slug: string; estado: string; sellado_en: string | null };
  funcionalidades: {
    total: number;
    fuente_del_conteo: string;
    grupos: Grupo[];
  };
  metricas: Metrica[];
  enlaces: Record<string, string | null>;
};
const exportado = JSON.parse(exportRaw) as Export;
const brochure = leer("docs/BROCHURE.html");
const manual = leer("docs/MANUAL-DE-USO.md");

const FUENTES_VALIDAS = ["medido", "calculada", "declarado", "estimacion"];

describe("brochure-export: contrato v1.0.0", () => {
  it("conserva el bloque _schema y la versión del FORMATO", () => {
    expect(exportado.schema_version).toBe("1.0.0");
    expect(exportado._schema).toBeTypeOf("object");
    // El esquema viaja CON el archivo: quien lo consuma no busca otro documento.
    expect(exportado._schema._lee_esto_primero).toContain("formato");
    expect(exportado._schema["metricas[].fuente"]).toBeTruthy();
  });

  it("declara la app en estado inicial, sin sellar", () => {
    expect(exportado.app.slug).toBe("nutri-kids");
    expect(exportado.app.estado).toBe("inicial");
    expect(exportado.app.sellado_en).toBeNull();
  });

  it("TODA métrica lleva una fuente válida (una cifra sin fuente no entra)", () => {
    expect(Array.isArray(exportado.metricas)).toBe(true);
    expect(exportado.metricas.length).toBeGreaterThan(0);
    for (const m of exportado.metricas) {
      expect(
        FUENTES_VALIDAS,
        `métrica «${m.clave}» sin fuente válida`,
      ).toContain(m.fuente);
      expect(m.detalle, `métrica «${m.clave}» sin detalle`).toBeTruthy();
      expect(typeof m.valor).toBe("number");
    }
  });

  it("no entrega enlaces: producción y repositorio van en null con su razón (regla 17)", () => {
    expect(exportado.enlaces.produccion).toBeNull();
    expect(exportado.enlaces.repositorio).toBeNull();
    expect(exportado.enlaces.razon).toBeTruthy();
    expect(exportado.enlaces.razon_repositorio).toBeTruthy();
  });

  it("ninguna URL de despliegue se cuela en el export ni en el brochure", () => {
    const prohibido = /vercel\.app|workers\.dev|https?:\/\/(?!www\.w3\.org)/i;
    expect(exportRaw).not.toMatch(prohibido);
    expect(brochure).not.toMatch(prohibido);
  });
});

describe("brochure-export: el conteo es evidencia, no afirmación", () => {
  const total: number = exportado.funcionalidades.total;

  it("cuadra el total contra la suma real de features de los grupos", () => {
    const suma = exportado.funcionalidades.grupos.reduce(
      (n: number, g: Grupo) => n + g.features.length,
      0,
    );
    expect(suma).toBe(total);
  });

  it("declara contra qué documento se cuadró, y ese documento existe", () => {
    expect(exportado.funcionalidades.fuente_del_conteo).toBe(
      "docs/MANUAL-DE-USO.md",
    );
    expect(manual.length).toBeGreaterThan(0);
  });

  it("cada feature apunta a una sección REAL del manual", () => {
    for (const grupo of exportado.funcionalidades.grupos) {
      for (const f of grupo.features) {
        expect(f.seccion_manual, `«${f.nombre}» sin sección`).toBeTruthy();
        expect(f.que_hace, `«${f.nombre}» sin descripción`).toBeTruthy();
      }
    }
  });

  it("el N del pie del brochure es el mismo del export", () => {
    // El pie declara el número en texto accesible desde el primer byte.
    expect(brochure).toMatch(new RegExp(`id="conteo-cifra"[^>]*>${total}<`));
    // …y el brochure tiene exactamente esa cantidad de bloques .feature.
    const features = brochure.match(/class="feature"/g) ?? [];
    expect(features.length).toBe(total);
  });
});

describe("brochure: reglas de la pieza", () => {
  it("es autocontenido: cero CDNs, cero fetch, cero recursos externos", () => {
    expect(brochure).not.toMatch(/<script[^>]+src=/i);
    expect(brochure).not.toMatch(/<link[^>]+href=["']http/i);
    expect(brochure).not.toMatch(/\bfetch\s*\(/);
  });

  it("declara el estado INICIAL en la cabecera", () => {
    expect(brochure).toMatch(/Brochure inicial/i);
    expect(brochure).toMatch(/Se sella cuando terminen las pruebas/i);
  });

  it("usa el patrón de a11y canónico h3 > button (jamás button > h3)", () => {
    expect(brochure).toMatch(/<h3 class="tarjeta-cabeza">\s*<button/);
    expect(brochure).not.toMatch(/<button[^>]*>\s*<h3/);
  });

  it("no nombra calorías, peso, IMC ni percentiles como algo que la app haga", () => {
    // Aparecen SOLO en la lista explícita de «palabras que esta app no dice».
    const listaNo = brochure.slice(
      brochure.indexOf('class="lista-no"'),
      brochure.indexOf("</ul>", brochure.indexOf('class="lista-no"')),
    );
    for (const palabra of ["calorías", "peso", "IMC", "percentil"]) {
      expect(listaNo).toContain(palabra);
    }
  });

  it("cada tarjeta lleva su muestra de interfaz, DIBUJADA y no incrustada", () => {
    // Delta 1: donde más información hay, la palabra va acompañada de la pantalla de
    // la que habla. Dibujadas en SVG a propósito: una captura incrustada engordaría el
    // archivo, envejecería en silencio y podría arrastrar píxeles no revisados.
    const muestras = brochure.match(/<figure class="muestra">/g) ?? [];
    expect(muestras.length).toBe(5);
    expect(brochure).not.toMatch(/data:image/i);
    expect(brochure).not.toMatch(/<img\b/i);
    // El SVG es ilustración: el sentido lo carga el pie, en palabras.
    const pies = brochure.match(/<figcaption>/g) ?? [];
    expect(pies.length).toBe(5);
  });

  it("el peso declarado en el export es el del archivo de verdad", () => {
    // Una métrica «medida» que nadie vuelve a medir se convierte en una afirmación.
    const peso = exportado.metricas.find((m) => m.clave === "peso_brochure");
    expect(peso, "falta la métrica peso_brochure").toBeTruthy();
    expect(peso!.fuente).toBe("medido");
    expect(peso!.valor).toBe(
      statSync(resolve(raiz, "docs/BROCHURE.html")).size,
    );
  });

  it("la ruta /conoce sirve los MISMOS bytes que docs/BROCHURE.html", () => {
    // Si alguien edita una sola de las dos copias, esto se pone rojo antes de publicar.
    const servido = leer("public/conoce.html");
    expect(servido).toBe(brochure);
  });
});
