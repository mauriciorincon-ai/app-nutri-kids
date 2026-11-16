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

/** Métodos y funciones que COMPARAN o BUSCAN con una cadena literal. */
const MATCHERS = new Set([
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "lastIndexOf",
  "replace",
  "replaceAll",
  "split",
  "has",
  "match",
  "search",
]);
/** Valores internos del propio lector (tipos de página), no texto del PDF. */
const INTERNAL = new Set(["none"]);

type Found = { text: string; line: number; kind: "regex" | "string" };

/**
 * Lo que el lector usa para reconocer texto: cada regex literal, lo estático de cada
 * `new RegExp(…)`, y toda cadena literal pasada a un método que busca o compara
 * (`includes`, `startsWith`, `has`, …) o comparada con `===`/`!==`/`in`.
 */
function patterns(): Found[] {
  const src = ts.createSourceFile(
    SOURCE,
    readFileSync(SOURCE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const out: Found[] = [];
  const at = (n: ts.Node) =>
    src.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const literal = (n: ts.Node): string | undefined =>
    ts.isStringLiteralLike(n)
      ? n.text
      : ts.isTemplateExpression(n)
        ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ")
        : undefined;
  const visit = (n: ts.Node) => {
    if (ts.isRegularExpressionLiteral(n)) {
      out.push({
        text: n.text.slice(1, n.text.lastIndexOf("/")),
        line: at(n),
        kind: "regex",
      });
    } else if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "RegExp" &&
      n.arguments?.[0]
    ) {
      const t = literal(n.arguments[0]);
      if (t !== undefined) out.push({ text: t, line: at(n), kind: "regex" });
    } else if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : "";
      if (MATCHERS.has(name))
        for (const a of n.arguments) {
          const t = literal(a);
          if (t !== undefined)
            out.push({ text: t, line: at(a), kind: "string" });
        }
    } else if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      // `typeof x === "string"` compara un tipo de JavaScript, no texto del PDF.
      const typeofCheck =
        ts.isTypeOfExpression(n.left) || ts.isTypeOfExpression(n.right);
      if (
        !typeofCheck &&
        (op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          op === ts.SyntaxKind.EqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsToken ||
          op === ts.SyntaxKind.InKeyword)
      )
        for (const side of [n.left, n.right]) {
          const t = literal(side);
          if (t !== undefined)
            out.push({ text: t, line: at(side), kind: "string" });
        }
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

const words = (f: Found) =>
  (
    fold(f.kind === "regex" ? strip(f.text) : f.text).match(/[a-z]{2,}/g) ?? []
  ).filter((w) => !INTERNAL.has(w));

/**
 * ¿Dos palabras literales seguidas? Entre ellas solo hay blancos, escapes de blanco o de
 * frontera (`\s`, `\W`, `\b`, con cuantificador), comodines (`.{0,5}`) o paréntesis de grupo.
 * Una alternación `a|b` NO es frase. En una cadena: dos palabras con un blanco entre ellas.
 */
const QUANT = String.raw`(?:[*+?]|\{\d+(?:,\d*)?\})?`;
const SEP = new RegExp(String.raw`(?:\\[sSwWbB]${QUANT}|\.${QUANT}|[\s()?:])+`);
const PHRASE = new RegExp(String.raw`[a-z]{2,}${SEP.source}[a-z]{2,}`, "i");
const isPhrase = (f: Found) =>
  f.kind === "regex"
    ? PHRASE.test(
        f.text.replace(/\\[pPu]\{[^}]*\}/g, "#").replace(/\[[^\]]*\]/g, "#"),
      )
    : /\p{L}{2,}\s+\p{L}{2,}/u.test(f.text);

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
    const unknown = patterns().flatMap((f) =>
      words(f)
        .filter((w) => !known(w))
        .map((w) => `${f.line}: ${w}`),
    );
    expect(unknown).toEqual([]);
  });

  it("ni una regex ni una cadena comparada lleva dos palabras literales seguidas (eso sería una frase de la plantilla)", () => {
    const phrases = patterns()
      .filter(isPhrase)
      .map((f) => `${f.line}: ${f.text}`);
    expect(phrases).toEqual([]);
  });

  it("la prueba revisa también las cadenas con las que el lector compara o busca", () => {
    const strings = patterns().filter((f) => f.kind === "string");
    expect(strings.some((f) => f.text === "dato")).toBe(true);
    expect(strings.some((f) => f.text === "del")).toBe(true);
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

  it.each([
    String.raw`tambi[eé]n\s+recomendamos\s+evitar`,
    String.raw`aditivos\s+(evitar)`,
    String.raw`aditivos\s{1,3}evitar`,
    String.raw`aditivos\W+evitar`,
    String.raw`aditivos.{0,5}evitar`,
    String.raw`(?:grupos)\s*(?:alimentarios)`,
  ])(
    "la prueba de frases atrapa la regex «%s» (se demuestra fallando)",
    (bad) => {
      expect(isPhrase({ text: bad, line: 0, kind: "regex" })).toBe(true);
    },
  );

  it.each(["frase completa", "titulo exacto de la plantilla"])(
    "la prueba de frases atrapa la cadena comparada «%s»",
    (bad) =>
      expect(isPhrase({ text: bad, line: 0, kind: "string" })).toBe(true),
  );

  it("una palabra sin declarar en una cadena comparada se atrapa", () => {
    expect(
      words({ text: "recomendamos", line: 0, kind: "string" }).filter(
        (w) => !known(w),
      ),
    ).toEqual(["recomendamos"]);
    expect(
      words({
        text: String.raw`tambi[eé]n\s+recomendamos`,
        line: 0,
        kind: "regex",
      }).filter((w) => !known(w)),
    ).toContain("recomendamos");
  });

  it("una alternación de palabras declaradas no es frase", () => {
    expect(
      isPhrase({
        text: String.raw`(?:reemplazar|alternativas)\b`,
        line: 0,
        kind: "regex",
      }),
    ).toBe(false);
    expect(
      isPhrase({ text: String.raw`(?:fl|oz|ml)\b`, line: 0, kind: "regex" }),
    ).toBe(false);
  });
});
