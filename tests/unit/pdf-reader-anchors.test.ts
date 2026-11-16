// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  ANCHOR_WORDS,
  DISCARD_WORDS,
  VALUE_WORDS,
  fold,
  has,
} from "@/lib/diet/pdf-reader";

/**
 * Decisión del dueño «1 a» (hallazgo 3.2 del S6): el lector solo se ancla en PALABRAS SUELTAS
 * genéricas; ninguna frase de la plantilla. Se revisa el CÓDIGO del lector, no solo su salida:
 * toda palabra escrita en una expresión regular debe estar declarada, y ninguna regex lleva
 * dos palabras literales seguidas.
 */
const SOURCE = join(__dirname, "../../src/lib/diet/pdf-reader.ts");
const LISTS = { ANCHOR_WORDS, VALUE_WORDS, DISCARD_WORDS };
const ALLOWED = new Set<string>([
  ...ANCHOR_WORDS,
  ...VALUE_WORDS,
  ...DISCARD_WORDS,
]);
const known = (w: string) =>
  ALLOWED.has(w) || ALLOWED.has(w.replace(/e?s$/, "")) || ALLOWED.has(`${w}s`);

/** Los patrones del lector: cada regex literal y lo estático de cada `new RegExp(…)`. */
function patterns(): { text: string; line: number }[] {
  const src = ts.createSourceFile(
    SOURCE,
    readFileSync(SOURCE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const out: { text: string; line: number }[] = [];
  const at = (n: ts.Node) =>
    src.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    if (ts.isRegularExpressionLiteral(n)) {
      out.push({ text: n.text.slice(1, n.text.lastIndexOf("/")), line: at(n) });
    } else if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "RegExp" &&
      n.arguments?.[0]
    ) {
      const a = n.arguments[0];
      if (ts.isStringLiteralLike(a)) out.push({ text: a.text, line: at(a) });
      else if (ts.isTemplateExpression(a))
        out.push({
          text: [
            a.head.text,
            ...a.templateSpans.map((s) => s.literal.text),
          ].join(" "),
          line: at(a),
        });
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

/** Quita escapes (`\s`, `\p{…}`, `\u{…}`) y clases `[…]`: quedan las letras escritas a mano. */
const strip = (p: string) =>
  p
    .replace(/\\[pPu]\{[^}]*\}/g, " ")
    .replace(/\\./g, " ")
    .replace(/\[[^\]]*\]/g, " ");

describe("las palabras ancla del lector (decisión «1 a»)", () => {
  it.each(Object.entries(LISTS))(
    "%s: palabras sueltas, sin espacio, sin tildes, sin repetir",
    (_, list) => {
      for (const w of list) {
        expect(w, w).toMatch(/^[a-z]+$/);
        expect(fold(w)).toBe(w);
      }
      expect(new Set(list).size).toBe(list.length);
    },
  );

  it("el lector encuentra expresiones regulares que revisar (la prueba no está vacía)", () => {
    expect(patterns().length).toBeGreaterThan(40);
  });

  it("toda palabra escrita en una regex del lector está declarada en una de las tres listas", () => {
    const unknown = patterns().flatMap(({ text, line }) =>
      (fold(strip(text)).match(/[a-z]{2,}/g) ?? [])
        .filter((w) => !known(w))
        .map((w) => `${line}: ${w}`),
    );
    expect(unknown).toEqual([]);
  });

  it("ninguna regex lleva dos palabras literales seguidas (eso sería una frase de la plantilla)", () => {
    const phrases = patterns()
      .map(({ text, line }) => ({
        line,
        hit: /[a-z]{2,}(?:\\s[*+?]?|\s|\(\?:)+[a-z]{2,}/i.exec(
          text.replace(/\\[pPu]\{[^}]*\}/g, "#").replace(/\[[^\]]*\]/g, "#"),
        )?.[0],
      }))
      .filter((p) => p.hit)
      .map((p) => `${p.line}: ${p.hit}`);
    expect(phrases).toEqual([]);
  });

  it("toda palabra que el lector pasa a `has()` es un ancla declarada", () => {
    const src = readFileSync(SOURCE, "utf8");
    const used = [
      ...src.matchAll(/\bhas\([^,()]+(?:\([^)]*\))?[^,()]*,\s*"([^"]+)"\)/g),
    ].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    for (const w of used)
      expect(ANCHOR_WORDS as readonly string[], w).toContain(w);
  });

  it("la detección es sin tildes ni mayúsculas, en singular o plural, y por palabra entera", () => {
    expect(has("MENÚ de muestra", "menu")).toBe(true);
    expect(has("Aditivo", "aditivos")).toBe(true);
    expect(has("una fuente", "fuentes")).toBe(true);
    expect(has("notas", "nota")).toBe(true);
    expect(has("anotación", "nota")).toBe(false);
    expect(has("suplementación", "suplemento")).toBe(false);
  });

  it("`fold` conserva la longitud (un índice del texto plegado sirve en el original)", () => {
    for (const s of ["Ñandú · Menú 🥩 ﬁ", "Ácido – E 951", "💧 Hidratación"])
      expect(fold(s)).toHaveLength(s.length);
  });

  it("la prueba de frases sí atrapa una frase (se demuestra fallando)", () => {
    const bad = String.raw`tambi[eé]n\s+recomendamos\s+evitar`;
    expect(
      /[a-z]{2,}(?:\\s[*+?]?|\s|\(\?:)+[a-z]{2,}/i.test(
        bad.replace(/\[[^\]]*\]/g, "#"),
      ),
    ).toBe(true);
    expect(
      (fold(strip(bad)).match(/[a-z]{2,}/g) ?? []).filter((w) => !known(w)),
    ).toContain("recomendamos");
  });
});
