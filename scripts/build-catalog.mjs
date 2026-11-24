#!/usr/bin/env node
/**
 * Arma el catálogo de productos de Colombia (S13 · ADR-019) desde Open Food Facts, UNA vez, en la
 * máquina de quien construye. Nunca corre en la CI ni en el runtime: la app solo lee el JSON que
 * sale de aquí (`data/catalog/off-co.json`) y el teléfono lo baja tras el toque.
 *
 * Open Food Facts es dato público bajo ODbL-1.0 (atribución y misma licencia). El catálogo jamás
 * lleva nada de un plan ni de una familia: solo lo que el empaque dice.
 *
 * Qué hace:
 *  - lee el volcado CSV oficial (`--csv`, 1,5 GB comprimido, en streaming y sin guardarlo) y se queda
 *    con las filas de Colombia; o pagina la API v2 (`countries_tags_en=colombia`, 100 por página). La
 *    API solo contesta las primeras 10 páginas por consulta (lo midió el S13): por eso el CSV;
 *  - descarta lo que no es comida (cosméticos, higiene, mascotas), los productos sin nombre y los
 *    códigos que no son un GTIN válido;
 *  - limpia el texto de ingredientes: sin teléfonos, direcciones, correos, enlaces, registros
 *    sanitarios ni «fabricado por…», y lo vacía si trae ruido de OCR (el catálogo dirá «no sé qué
 *    lleva» en vez de adivinar);
 *  - sale ordenado por código, sin duplicados.
 *
 * Uso: node scripts/build-catalog.mjs --csv <url|archivo.csv.gz> [--out data/catalog/off-co.json]
 *        [--allow-truncated]   (solo para probar con un trozo del archivo)
 *      node scripts/build-catalog.mjs --refine <catalogo.json> [--out …]   (aplica las reglas de hoy a un
 *        catálogo ya armado: sin descarga)
 *      node scripts/build-catalog.mjs [--out …] [--cache <dir>] [--delay-ms 6500] [--max-pages N] [--from-cache]
 * Con `--cache`, cada página queda en disco: una corrida cortada se reanuda donde iba.
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SOURCE = "Open Food Facts (countries_tags_en=colombia)";
export const LICENSE = "ODbL-1.0";
const API = "https://world.openfoodfacts.org/api/v2/search";
const FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "brands",
  "categories_tags",
  "ingredients_text",
  "ingredients_text_es",
  "additives_tags",
  "allergens_tags",
  "traces_tags",
].join(",");
/** Genérico a propósito: ni nombre ni contacto de nadie. */
const USER_AGENT = "nutrikids-catalog-build/1.0 (open-source catalog build)";

/** Dígito de control de un GTIN-8/12/13 (el mismo cálculo que `src/lib/scan/gtin.ts`). */
export function validGtin(code) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/** Lo que no es comida: cosmética, higiene, mascotas. */
const NON_FOOD =
  /^(?:[a-z]{2}:)?(?:non-food|open-beauty|cosmetic|beauty|hygiene|pet-food|petfood|pet-)/;
/**
 * Etiquetas de categoría ENTERAS que delatan lo que no se come: cuidado personal, limpieza, medicina y
 * suplementos (el plan los lleva en su calendario, no en el supermercado: «marcas aptas» jamás debe
 * ofrecer una vitamina como si fuera un alimento). Enteras a propósito: «potato-skins» o los cereales
 * «fortified-with-vitamins» sí son comida.
 */
const NON_FOOD_TAGS = new Set([
  "dietary-supplements",
  "food-supplements",
  "vitamins",
  "minerals",
  "vitamin-supplements",
  "hair",
  "hair-care",
  "skin-care",
  "body-care",
  "face-care",
  "oral-care",
  "personal-care",
  "shampoos",
  "soaps",
  "deodorants",
  "toothpastes",
  "perfumes",
  "detergents",
  "diapers",
  "household-products",
  "cleaning-products",
  "medicines",
  "medicine",
]);
/**
 * Nombres que no son de comida cuando la categoría no dice nada (6 de cada 10 productos vienen sin
 * ella). Sin `colágeno`, `cápsulas` ni `vitamina` sueltos: hay yogures con colágeno, cápsulas de café
 * y harinas fortificadas con vitaminas.
 */
const NON_FOOD_NAME = new RegExp(
  "(?<![\\p{L}\\d])(?:" +
    [
      "shampoo",
      "champ[uú]",
      "acondicionador",
      "conditioner",
      "jab[oó]n",
      "desodorante",
      "deodorant",
      "detergente",
      "suavizante",
      "dent[ií]frico",
      "toothpaste",
      "enjuague\\s+bucal",
      "perfume",
      "colonia",
      "maquillaje",
      "esmalte",
      "labial",
      "brillo\\s+labial",
      "pa[nñ]ales?",
      "toallas?\\s+higi[eé]nicas?",
      "papel\\s+higi[eé]nico",
      "desinfectante",
      "limpiador",
      "ambientador",
      "insecticida",
      "loci[oó]n",
      "capilar",
      "cabello(?!\\s+de\\s+[aá]ngel)",
      "hair\\s+food",
      "s[eé]rum",
      "serun",
      "toner",
      "mascarilla",
      "bb\\s+cream",
      "facial",
      "crema\\s+(?:hidratante|corporal|facial|dental|para\\s+(?:el\\s+)?(?:cuerpo|rostro|manos|pies))",
      "creatina",
      "creatine",
      "suplemento",
      "supplement",
      "fish\\s+oil",
      "aceite\\s+de\\s+pescado",
      "(?:citrato|glicinato|hidr[oó]xido|cloruro)\\s+de\\s+magnesio",
    ].join("|") +
    ")(?![\\p{L}\\d])|^(?:vitamina|vitamin)s?\\s?[a-dke]?\\d*(?:\\s|$)|^(?:super\\s+)?magnesium|^omega",
  "iu",
);
export function isFood(categories = [], name = "") {
  if (categories.some((c) => NON_FOOD.test(String(c)))) return false;
  for (const c of categories)
    if (NON_FOOD_TAGS.has(String(c).replace(/^[a-z]{2}:/, ""))) return false;
  return !NON_FOOD_NAME.test(String(name).trim());
}

/** Frases de contacto o de trámite que no son ingredientes. */
const CONTACT =
  /\b(?:tel(?:[eé]fono)?s?|cel(?:ular)?|whatsapp|ll[aá]m\w*|l[ií]nea\s+(?:de\s+)?(?:atenci[oó]n|gratuita|nacional)|servicio\s+al\s+cliente|contacto|registro\s+(?:sanitario|invima)|reg\.?\s*san|invima|notificaci[oó]n\s+sanitaria|nsa|nit|(?:fabricado|elaborado|producido|envasado|empacado|importado|distribuido|comercializado)\s+por|direcci[oó]n|dir\.|cll|calle|carrera|cra|km|avenida|av\.)\b|www\.|https?:|@|\.(?:com|co|net|org)\b/i;
/** Una frase suelta por palabras enteras, también con tilde al final («Bogotá»): `\b` no las ve. */
const wholeWords = (alternatives, flags = "iu") =>
  new RegExp(
    `(?<![\\p{L}\\d])(?:${alternatives.join("|")})(?![\\p{L}\\d])`,
    flags,
  );

/** Direcciones, empresas y orígenes: lo que dice dónde está o quién es la empresa, no qué lleva. */
const ADDRESS = new RegExp(
  wholeWords([
    "parque\\s+industrial",
    "zona\\s+franca",
    "vereda",
    "bodega",
    "oficinas?",
    "sede",
    "diag(?:onal)?",
    "transv(?:ersal)?",
    "kr",
    "cl",
    "cr",
    "ltda",
    "s\\.?\\s?a\\.?\\s?s",
    "s\\.\\s?a",
    "inc\\.?",
    "llc",
    "corp\\.?",
    "hecho\\s+en",
    "made\\s+in",
    "product\\s+of",
    "producto\\s+(?:colombiano|ecuatoriano|mexicano|peruano|importado)",
    "industria\\s+\\p{L}+",
    "importad[oa]",
    "distribuid[oa]",
    "consumidor",
    "piso\\s+\\d+",
    "d\\.\\s?c",
    "instruc\\w*",
    "modo\\s+de\\s+(?:uso|preparaci[oó]n)",
    "preparaci[oó]n",
    "lote",
    "vencimiento",
    "caducidad",
    "consumir\\s+preferiblemente",
    "agitar",
    "refrigerar",
    "refrigere",
    "colombia",
    "colombian[oa]?",
    "ecuador",
    "quito",
    "per[uú]",
    "m[eé]xico",
    "alemania",
    "suiza",
    "espa[nñ]a",
    "bogot[aá]",
    "medell[ií]n",
    "barranquilla",
    "bucaramanga",
    "cartagena",
    "funza",
    "itag[uü][ií]",
    "yumbo",
    "mosquera",
    "palmira",
    "cota",
    "ch[ií]a",
    "soacha",
    "envigado",
    "sabaneta",
    "rionegro",
    "manizales",
    "pereira",
    "cali",
    "texas",
    "california",
    "florida",
    "street",
    "avenue",
    "road",
    "blvd",
    "boulevard",
  ]).source +
    "|(?<![\\p{L}\\d])n[o°º]\\.?\\s*\\d+[a-z]?\\s*[-–#]\\s*\\d|#\\s*\\d+[a-z]?\\s*[-–]\\s*\\d+|(?<![\\p{L}\\d])[a-z]{2,5}\\d{5,}(?![\\p{L}\\d])",
  "iu",
);
/**
 * Lo que es la tabla del empaque, no la lista de ingredientes: calorías, porciones, «% VD», grasas
 * totales, «Supplement Facts». Regla dura 2: ni calorías ni cantidades llegan a la app.
 */
export const NUTRITION = new RegExp(
  wholeWords([
    "kcal",
    "kj",
    "calor\\p{L}*",
    "energ[ií]a",
    "energ[eé]tic[oa]s?",
    "energy",
    "nutrition(?:al)?\\s+facts",
    "supplement\\s+facts",
    "informaci[oó]n\\s+nutricional",
    "(?<!levadura\\s)nutricional",
    "nutritional(?!\\s+yeast)",
    "valor(?:es)?\\s+(?:energ[eé]tico|diarios?|nutricional)",
    "daily\\s+values?",
    "%\\s?(?:vd|dv)",
    "serving\\s+size",
    "servings?\\s+per",
    "porci[oó]n(?:es)?",
    "tama[nñ]o\\s+(?:de|por)\\s+(?:la\\s+)?porci[oó]n",
    "cantidad\\s+por",
    "amount\\s+per",
    "grasa\\s+(?:total|saturada)",
    "total\\s+(?:fat|carb\\w*)",
    "carbohidratos?\\s+totales?",
    "carb\\.?\\s+total",
    "grasa\\s+trans",
    "colesterol\\s+\\d+",
    "sodio\\s+\\d+\\s*mg",
    "prote[ií]nas?\\s+\\d+\\s*g",
  ]).source + "|\\d\\s?%\\s?(?:vd|dv)(?![\\p{L}\\d])",
  "iu",
);
/** Donde empieza la lista de ingredientes dentro de un texto que antes trae la tabla. */
const ING_MARK = /(?<![\p{L}\d])(?:ingredientes?|ingredients?)\s*:/iu;
/** Teléfonos y registros: 7 o más cifras, aunque vengan con espacios, guiones o paréntesis. */
const LONG_NUMBER = /\+?\(?\d[\d\s().-]{5,}\d/g;

/** Un trozo que es casi todo cifras («13.300, /0020-47»): un registro o una dirección, no ingredientes. */
function mostlyNumbers(sentence) {
  const digits = (sentence.match(/\d/g) ?? []).length;
  const groups = (sentence.match(/\d+/g) ?? []).length;
  const nonSpace = sentence.replace(/\s/g, "").length;
  const letters = (sentence.match(/\p{L}{3,}/gu) ?? []).length;
  return groups >= 3 && letters <= 3 && digits / nonSpace > 0.15;
}

/**
 * Una frase con la tabla nutricional pierde la tabla: si trae «Ingredientes:» después, se queda
 * desde ahí (y se vuelve a mirar); si no, la frase entera sale.
 */
function withoutNutrition(sentence) {
  if (!NUTRITION.test(sentence)) return sentence;
  const mark = ING_MARK.exec(sentence);
  if (!mark) return "";
  const rest = sentence.slice(mark.index + mark[0].length).trim();
  return NUTRITION.test(rest) ? "" : rest;
}

/**
 * El texto de ingredientes, sin lo que identifica a una empresa o a una persona: se parte en frases
 * (saltos de línea, puntos) y se quita la que trae contacto; luego, cualquier tira de 7+ cifras.
 * Vacío si lo que queda es ruido (poca letra, pocas palabras).
 */
export function cleanIngredients(raw) {
  if (typeof raw !== "string") return "";
  const sentences = raw
    .normalize("NFC")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.;])\s+/)
    .map((s) => s.trim())
    .map((s) => withoutNutrition(s))
    .filter(
      (s) =>
        /\p{L}{3,}/u.test(s) &&
        !CONTACT.test(s) &&
        !ADDRESS.test(s) &&
        !mostlyNumbers(s),
    );
  let text = sentences.join(" ").replace(LONG_NUMBER, (m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length >= 7 ? " " : m;
  });
  text = text.replace(/\s{2,}/g, " ").trim();
  if (text.length > 1500)
    text = text
      .slice(0, 1500)
      .replace(/[^\s]*$/, "")
      .trim();
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const nonSpace = text.replace(/\s/g, "").length;
  const words = (text.match(/\p{L}{3,}/gu) ?? []).length;
  if (words < 2 || nonSpace === 0 || letters / nonSpace < 0.6) return "";
  return text;
}

/** «en:e150d» → «E150D»; lo que no es un código E sale. */
export function additiveCode(tag) {
  const m = /^en:e(\d{3,4})([a-z]?)$/i.exec(String(tag));
  // La numeración internacional de aditivos va de 100 a 1599 (como `findCodes` en la app).
  if (!m || Number(m[1]) < 100 || Number(m[1]) > 1599) return null;
  return `E${m[1]}${m[2].toUpperCase()}`;
}

/** Solo las etiquetas en inglés de Open Food Facts (`en:milk`); las que otros ponen a mano, fuera. */
export function plainTags(tags = []) {
  const out = new Set();
  for (const t of tags) {
    const m = /^en:([a-z0-9][a-z0-9-]{1,60})$/.exec(String(t));
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}

const oneLine = (s, max) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/**
 * El nombre sin la promesa de calorías («Light en Calorías», «Cero Calorías»): regla dura 2, ni calorías
 * ni cifras de energía en datos ni en copy, tampoco las que trae el empaque en su nombre.
 */
export function plainName(name) {
  let out = String(name)
    .replace(
      /(?<![\p{L}\d])(?:(?:light|sin|cero|baja|bajo|reducid[oa]|menos)\s+)*(?:(?:en|de|y)\s+)*calor[ií]as?(?![\p{L}\d])/giu,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  // Lo que quedó colgando al final: «… reducida en grasa y», «… Descremado Light».
  for (;;) {
    const next = out.replace(
      /\s+(?:y|en|de|light|baja|bajo|reducid[oa]|sin|cero)$/i,
      "",
    );
    if (next === out) return out;
    out = next;
  }
}

/** Un producto de Open Food Facts → una entrada del catálogo, o `null` si no entra. */
export function cleanProduct(raw) {
  const code = String(raw?.code ?? "").trim();
  if (!validGtin(code)) return null;
  const name = plainName(oneLine(raw.product_name_es || raw.product_name, 120));
  if (!isFood(raw.categories_tags, name)) return null;
  if (name.length < 2 || CONTACT.test(name)) return null;
  // Un «nombre» que es el código de barras o un registro (6+ cifras seguidas) no le sirve a nadie.
  if (/\d{6,}/.test(name) || (name.match(/\p{L}/gu) ?? []).length < 2)
    return null;
  const brand = oneLine(String(raw.brands ?? "").split(",")[0], 60);
  const cats = (raw.categories_tags ?? [])
    .map((c) => /^en:([a-z0-9-]+)$/.exec(String(c))?.[1])
    .filter(Boolean)
    .slice(-8);
  return {
    code,
    name,
    brand: CONTACT.test(brand) ? "" : brand,
    cat: cats,
    ing: cleanIngredients(raw.ingredients_text_es || raw.ingredients_text),
    add: [
      ...new Set((raw.additives_tags ?? []).map(additiveCode).filter(Boolean)),
    ].sort(),
    alg: plainTags(raw.allergens_tags),
    tr: plainTags(raw.traces_tags),
  };
}

/**
 * Aplica las reglas de hoy a un producto que YA está en el catálogo (sin volver a bajar 1,5 GB):
 * sale si no es comida y su texto de ingredientes se vuelve a limpiar. Las mismas funciones que
 * `cleanProduct`, así el catálogo reconstruido y el refinado dan lo mismo.
 */
export function refineProduct(p) {
  const name = plainName(p.name);
  if (name.length < 2 || !isFood(p.cat, name)) return null;
  return { ...p, name, ing: cleanIngredients(p.ing) };
}

export function refineCatalog(catalog) {
  const products = catalog.products.map(refineProduct).filter(Boolean);
  return { ...catalog, products };
}

export function buildCatalog(rawProducts, generated) {
  const byCode = new Map();
  for (const raw of rawProducts) {
    const p = cleanProduct(raw);
    if (p && !byCode.has(p.code)) byCode.set(p.code, p);
  }
  const products = [...byCode.values()].sort((a, b) =>
    a.code < b.code ? -1 : 1,
  );
  return { generated, license: LICENSE, source: SOURCE, products };
}

/** El volcado oficial de Open Food Facts (CSV con tabuladores, gzip). */
export const CSV_URL =
  "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";

/** «Soybeans», «Sulphur dioxide» → «en:soybeans», «en:sulphur-dioxide»; lo que trae otro idioma («es:amande») sale. */
function allergenTags(csv = "") {
  return csv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[a-z0-9][a-z0-9 -]{1,60}$/.test(t))
    .map((t) => `en:${t.replace(/\s+/g, "-")}`);
}

const list = (csv = "") =>
  csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Una fila del CSV → la forma que devuelve la API, para que `cleanProduct` sea el único limpiador.
 * `index` es `{ columna: posición }` de la fila de títulos; `null` si la fila no es de Colombia.
 */
export function csvRowToRaw(index, fields) {
  const at = (name) => fields[index[name]] ?? "";
  if (!list(at("countries_tags")).includes("en:colombia")) return null;
  return {
    code: at("code"),
    product_name: at("product_name"),
    brands: at("brands"),
    categories_tags: list(at("categories_tags")),
    ingredients_text: at("ingredients_text"),
    additives_tags: list(at("additives_tags")),
    allergens_tags: allergenTags(at("allergens_en")),
    traces_tags: list(at("traces_tags")),
  };
}

/** Lee el CSV (URL o archivo) en streaming y devuelve las filas de Colombia ya en la forma de la API. */
export async function readCsv(source, { allowTruncated = false } = {}) {
  let input;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok || !res.body)
      throw new Error(`HTTP ${res.status} al bajar el volcado`);
    input = Readable.fromWeb(res.body);
  } else input = createReadStream(source);
  const gunzip = createGunzip();
  let truncated = false;
  gunzip.on("error", (e) => {
    if (allowTruncated && e.code === "Z_BUF_ERROR") truncated = true;
    else gunzip.destroy(e);
  });
  input.on("error", (e) => gunzip.destroy(e));
  input.pipe(gunzip);
  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });
  const raws = [];
  let index = null;
  let rows = 0;
  try {
    for await (const line of rl) {
      const fields = line.split("\t");
      if (!index) {
        index = Object.fromEntries(fields.map((h, i) => [h, i]));
        for (const need of [
          "code",
          "product_name",
          "countries_tags",
          "ingredients_text",
        ])
          if (!(need in index))
            throw new Error(`el CSV no trae la columna «${need}»`);
        continue;
      }
      rows++;
      const raw = csvRowToRaw(index, fields);
      if (raw) raws.push(raw);
    }
  } catch (e) {
    if (!(allowTruncated && truncated)) throw e;
  }
  return { raws, rows };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Una página, con reintentos y espera creciente ante 429/5xx/cortes (la API se satura a ratos). */
async function fetchPage(page, doFetch = fetch, tries = 12) {
  const url = `${API}?countries_tags_en=colombia&page_size=100&page=${page}&sort_by=created_t&fields=${FIELDS}`;
  for (let n = 0; n < tries; n++) {
    try {
      const res = await doFetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) return await res.json();
      // 401/403/408/429 y los 5xx son de la API saturada o de su cortafuegos: se espera y se reintenta.
      if (![401, 403, 408, 429].includes(res.status) && res.status < 500)
        throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (String(e?.message).startsWith("HTTP ")) throw e;
    }
    await sleep(Math.min(90_000, 5_000 * 2 ** n));
  }
  throw new Error(`la página ${page} no respondió tras ${tries} intentos`);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, fallback) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const out = arg("--out", join(root, "data/catalog/off-co.json"));
  const refine = arg("--refine", "");
  if (refine) {
    const before = JSON.parse(readFileSync(refine, "utf8"));
    const after = refineCatalog(before);
    writeFileSync(out, JSON.stringify(after));
    const withIng = after.products.filter((p) => p.ing).length;
    console.log(
      `refinado: ${before.products.length} → ${after.products.length} productos (${withIng} con ingredientes) → ${out}`,
    );
    return;
  }
  const cache = arg("--cache", "");
  const delay = Number(arg("--delay-ms", "6500"));
  const maxPages = Number(arg("--max-pages", "0"));
  const fromCache = args.includes("--from-cache");
  const csv = arg("--csv", "");
  if (cache) mkdirSync(cache, { recursive: true });

  const raws = [];
  let total = Infinity;
  if (csv) {
    const read = await readCsv(csv, {
      allowTruncated: args.includes("--allow-truncated"),
    });
    raws.push(...read.raws);
    console.log(`volcado: ${read.rows} filas, ${raws.length} de Colombia`);
    total = 0;
  }
  for (let page = 1; (page - 1) * 100 < total; page++) {
    if (maxPages && page > maxPages) break;
    const file =
      cache && join(cache, `page-${String(page).padStart(4, "0")}.json`);
    let body;
    if (file && existsSync(file)) body = JSON.parse(readFileSync(file, "utf8"));
    else {
      if (fromCache) break;
      body = await fetchPage(page);
      if (file) writeFileSync(file, JSON.stringify(body));
      await sleep(delay);
    }
    total = Number(body.count) || total;
    raws.push(...(body.products ?? []));
    console.log(`página ${page}: ${raws.length} de ${total}`);
  }
  const catalog = buildCatalog(raws, new Date().toISOString().slice(0, 10));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(catalog));
  const withIng = catalog.products.filter((p) => p.ing).length;
  console.log(
    `catálogo: ${catalog.products.length} productos (${withIng} con ingredientes) → ${out}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`build-catalog: ${e.message}`);
    process.exit(1);
  });
}
