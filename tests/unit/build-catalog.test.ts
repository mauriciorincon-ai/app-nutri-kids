// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LICENSE,
  additiveCode,
  buildCatalog,
  cleanIngredients,
  cleanProduct,
  csvRowToRaw,
  isFood,
  plainName,
  plainTags,
  refineCatalog,
  refineProduct,
  validGtin,
} from "../../scripts/build-catalog.mjs";
import { catalogMetaSchema, productSchema } from "@/lib/catalog/schema";

/**
 * El limpiador del catálogo (S13 · ADR-019). El catálogo es dato público de Open Food Facts, pero su
 * texto trae teléfonos, direcciones, registros sanitarios y enlaces de fabricantes: nada de eso
 * llega al teléfono. Los productos de abajo están INVENTADOS para la prueba.
 */
const root = join(__dirname, "../..");
const raw = (over: Record<string, unknown> = {}) => ({
  code: "7702535016688",
  product_name: "Galletas demo",
  brands: "Marca Demo, Otra",
  categories_tags: ["en:snacks", "en:biscuits"],
  ingredients_text: "harina de trigo, azúcar, sal, aceite de palma",
  additives_tags: ["en:e102", "en:e150d", "en:e9999"],
  allergens_tags: ["en:gluten", "es:no-es-ingles"],
  traces_tags: ["en:milk"],
  ...over,
});

describe("cleanIngredients: sin contacto ni trámites", () => {
  it("quita teléfonos con cualquier formato, también con espacios, guiones y paréntesis", () => {
    for (const phone of [
      "Línea de atención 01 8000 123456",
      "Tel: (601) 234-5678",
      "WhatsApp +57 300 123 4567",
      "llámenos al 3001234567",
    ]) {
      const out = cleanIngredients(`harina de trigo, azúcar, sal. ${phone}.`);
      expect(out, phone).toBe("harina de trigo, azúcar, sal.");
      expect(/\d{7}/.test(out.replace(/\D/g, "") && out), phone).toBe(false);
    }
  });

  it("quita tiras de 7 o más cifras sueltas, pero deja los códigos E y los porcentajes", () => {
    const out = cleanIngredients(
      "harina de trigo, azúcar 12 %, colorante E-102, sal 3456789 aceite de palma",
    );
    expect(out).toContain("E-102");
    expect(out).toContain("12 %");
    expect(out).not.toMatch(/\d{7}/);
  });

  it("quita enlaces, correos, registros sanitarios, direcciones y «fabricado por…»", () => {
    const lines = [
      "Visítenos en www.ejemplo.com.co",
      "Escríbanos a contacto@ejemplo.co",
      "Registro sanitario INVIMA RSAA12345",
      "Fabricado por Industrias Demo S.A.",
      "Elaborado por una empresa demo",
      "Importado por Demo Ltda",
      "Dirección: Calle 1 # 2-3",
      "Servicio al cliente 24 horas",
      "https://ejemplo.com/producto",
    ];
    for (const l of lines) {
      const out = cleanIngredients(`harina de trigo, azúcar, sal. ${l}.`);
      expect(out, l).toBe("harina de trigo, azúcar, sal.");
    }
  });

  it("deja «elaborado en una planta que procesa…»: es una traza, no un contacto", () => {
    const out = cleanIngredients(
      "harina de trigo, azúcar, sal. Elaborado en una planta que procesa soya.",
    );
    expect(out).toContain("Elaborado en una planta que procesa soya");
  });

  it("un texto con ruido, vacío o sin palabras queda vacío: el catálogo dirá «no sé qué lleva»", () => {
    for (const noisy of [
      "",
      "   ",
      "x%$# 12 @@ ¿¿ ~~ ||| 4 5 6",
      "#### ----",
      42,
      null,
    ])
      expect(cleanIngredients(noisy as string), String(noisy)).toBe("");
    expect(cleanIngredients("a b")).toBe("");
  });

  it("recorta lo larguísimo sin partir una palabra", () => {
    const out = cleanIngredients("azúcar harina ".repeat(500));
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.endsWith("azúcar") || out.endsWith("harina")).toBe(true);
  });
});

describe("cleanProduct", () => {
  it("un producto normal sale limpio, con aditivos en E y etiquetas sin prefijo", () => {
    const p = cleanProduct(raw());
    expect(p).toMatchObject({
      code: "7702535016688",
      name: "Galletas demo",
      brand: "Marca Demo",
      cat: ["snacks", "biscuits"],
      add: ["E102", "E150D"],
      alg: ["gluten"],
      tr: ["milk"],
    });
    expect(productSchema.safeParse(p).success).toBe(true);
  });

  it("descarta lo que no es comida: cosmética, higiene, mascotas", () => {
    for (const cat of [
      "en:non-food-products",
      "en:open-beauty-facts",
      "en:cosmetics",
      "en:beauty",
      "en:hygiene",
      "en:pet-food",
    ])
      expect(
        cleanProduct(raw({ categories_tags: ["en:snacks", cat] })),
        cat,
      ).toBeNull();
    expect(isFood(["en:snacks"])).toBe(true);
  });

  it("descarta códigos que no son un GTIN válido y productos sin nombre", () => {
    expect(cleanProduct(raw({ code: "7702535016689" }))).toBeNull();
    expect(cleanProduct(raw({ code: "123" }))).toBeNull();
    expect(cleanProduct(raw({ code: undefined }))).toBeNull();
    expect(
      cleanProduct(raw({ product_name: "", product_name_es: "" })),
    ).toBeNull();
    expect(cleanProduct(raw({ product_name: "  " }))).toBeNull();
  });

  it("prefiere el nombre y los ingredientes en español", () => {
    const p = cleanProduct(
      raw({
        product_name: "Demo cookies",
        product_name_es: "Galletas demo",
        ingredients_text: "wheat flour, sugar, salt, palm oil",
        ingredients_text_es: "harina de trigo, azúcar, sal, aceite de palma",
      }),
    );
    expect(p?.name).toBe("Galletas demo");
    expect(p?.ing).toBe("harina de trigo, azúcar, sal, aceite de palma");
  });

  it("un nombre que es el código de barras o un registro no entra", () => {
    expect(cleanProduct(raw({ product_name: "7700304206575" }))).toBeNull();
    expect(cleanProduct(raw({ product_name: "RSAA0217502" }))).toBeNull();
    expect(cleanProduct(raw({ product_name: "12" }))).toBeNull();
    expect(cleanProduct(raw({ product_name: "Leche 1 L" }))?.name).toBe(
      "Leche 1 L",
    );
  });

  it("una marca que parece un contacto no entra", () => {
    expect(cleanProduct(raw({ brands: "www.demo.com" }))?.brand).toBe("");
  });

  it("las etiquetas que no son del inglés de Open Food Facts no entran", () => {
    expect(
      plainTags(["en:milk", "es:leche", "fr:lait", "en:Bad", "en:tree-nuts"]),
    ).toEqual(["milk", "tree-nuts"]);
    expect(additiveCode("en:e150d")).toBe("E150D");
    expect(additiveCode("en:e12")).toBeNull();
    expect(additiveCode("en:e9999")).toBeNull();
    expect(additiveCode("es:e102")).toBeNull();
  });
});

describe("csvRowToRaw: una fila del volcado CSV", () => {
  const header = [
    "code",
    "product_name",
    "brands",
    "categories_tags",
    "countries_tags",
    "ingredients_text",
    "allergens_en",
    "traces_tags",
    "additives_tags",
  ];
  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const row = (over: Partial<Record<(typeof header)[number], string>> = {}) =>
    header.map(
      (h) =>
        ({
          code: "7702535016688",
          product_name: "Galletas demo",
          brands: "Marca Demo",
          categories_tags: "en:snacks,en:biscuits,es:Despensa/Galletas",
          countries_tags: "en:colombia,en:ecuador",
          ingredients_text: "harina de trigo, azúcar, sal",
          allergens_en: "gluten,milk,es:amande",
          traces_tags: "en:nuts,en:peanuts",
          additives_tags: "en:e102,en:e150d",
          ...over,
        })[h] ?? "",
    );

  it("una fila de Colombia sale con la forma de la API, y el limpiador es el mismo", () => {
    const rawProduct = csvRowToRaw(index, row());
    expect(rawProduct).toMatchObject({
      code: "7702535016688",
      allergens_tags: ["en:gluten", "en:milk"],
      traces_tags: ["en:nuts", "en:peanuts"],
      additives_tags: ["en:e102", "en:e150d"],
    });
    const product = cleanProduct(rawProduct);
    expect(product?.alg).toEqual(["gluten", "milk"]);
    expect(product?.cat).toEqual(["snacks", "biscuits"]);
    expect(product?.add).toEqual(["E102", "E150D"]);
  });

  it("una fila de otro país no entra, ni una cuyo país solo se parece", () => {
    expect(csvRowToRaw(index, row({ countries_tags: "en:france" }))).toBeNull();
    expect(
      csvRowToRaw(index, row({ countries_tags: "en:colombia-demo" })),
    ).toBeNull();
  });

  it("los alérgenos con espacios se vuelven la etiqueta de siempre; lo de otro idioma, no", () => {
    const rawProduct = csvRowToRaw(
      index,
      row({ allergens_en: "Sulphur dioxide and sulphites,fr:avoine" }),
    );
    expect(rawProduct?.allergens_tags).toEqual([
      "en:sulphur-dioxide-and-sulphites",
    ]);
  });

  it("una fila corta no revienta: los campos que faltan salen vacíos", () => {
    const rawProduct = csvRowToRaw(index, row().slice(0, 5));
    expect(rawProduct?.ingredients_text).toBe("");
    expect(rawProduct?.allergens_tags).toEqual([]);
  });
});

describe("buildCatalog", () => {
  it("sin duplicados, ordenado por código, con licencia y fuente", () => {
    const c = buildCatalog(
      [
        raw(),
        raw({ product_name: "Repetido" }),
        raw({ code: "96385074", product_name: "Otro" }),
        raw({ code: "9", product_name: "Roto" }),
      ],
      "2026-11-22",
    );
    expect(c.license).toBe(LICENSE);
    expect(c.generated).toBe("2026-11-22");
    expect(c.products.map((p: { code: string }) => p.code)).toEqual(
      ["7702535016688", "96385074"].sort(),
    );
    expect(
      c.products.find((p: { code: string }) => p.code === "7702535016688").name,
    ).toBe("Galletas demo");
  });
});

/** El catálogo real que viaja en el repo: aquí se prueba lo que queda DESPUÉS de la limpieza. */
describe("data/catalog/off-co.json (el que baja el teléfono)", () => {
  const file = join(root, "data/catalog/off-co.json");
  const catalog = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : null;

  it("existe y trae su licencia ODbL, su fuente y su fecha", () => {
    expect(catalog).not.toBeNull();
    expect(catalog.license).toBe("ODbL-1.0");
    expect(catalog.source).toMatch(/Open Food Facts/);
    expect(catalog.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      catalogMetaSchema.safeParse({
        generated: catalog.generated,
        license: catalog.license,
        source: catalog.source,
        count: catalog.products.length,
      }).success,
    ).toBe(true);
  });

  it("es un catálogo de verdad: miles de productos, todos válidos, sin repetir", () => {
    expect(catalog.products.length).toBeGreaterThan(2000);
    const seen = new Set<string>();
    for (const p of catalog.products) {
      expect(productSchema.safeParse(p).success, p.code).toBe(true);
      expect(validGtin(p.code), p.code).toBe(true);
      expect(seen.has(p.code), p.code).toBe(false);
      seen.add(p.code);
    }
  });

  it("no queda ningún teléfono, correo, enlace ni registro sanitario en lo que el teléfono baja", () => {
    const bad =
      /www\.|https?:|@|\b(?:tel[eé]fono|whatsapp|invima|registro sanitario|fabricado por|importado por)\b|\d{7,}/i;
    for (const p of catalog.products) {
      for (const field of [p.name, p.brand, p.ing] as string[])
        expect(bad.test(field), `${p.code}: ${field.slice(0, 80)}`).toBe(false);
    }
  });

  it("nada de lo que no es comida", () => {
    for (const p of catalog.products)
      expect(isFood(p.cat, p.name), p.code).toBe(true);
  });

  it("jamás lleva nada de un plan ni de una familia: solo los campos del producto público", () => {
    for (const p of catalog.products)
      expect(Object.keys(p).sort()).toEqual([
        "add",
        "alg",
        "brand",
        "cat",
        "code",
        "ing",
        "name",
        "tr",
      ]);
  });

  it("ni calorías ni tabla nutricional ni «% VD» en lo que baja el teléfono (regla dura 2)", () => {
    const bad =
      /\bkcal\b|\bkj\b|calor\p{L}*|nutrition facts|supplement facts|informaci[oó]n nutricional|serving size|valor(?:es)? diarios?|%\s?(?:vd|dv)\b/iu;
    for (const p of catalog.products)
      expect(bad.test(`${p.name} ${p.ing}`), `${p.code}: ${p.name}`).toBe(
        false,
      );
  });

  it("ni direcciones, empresas, ciudades ni registros en los ingredientes", () => {
    const bad =
      /\b(?:parque industrial|zona franca|ltda|s\.a\.s|bogot[aá]|medell[ií]n|barranquilla|colombia|ecuador|calle|carrera|vereda)\b|\bn[o°º]\.?\s*\d+[a-z]?\s*[-–#]\s*\d/iu;
    for (const p of catalog.products)
      expect(bad.test(p.ing), `${p.code}: ${p.ing.slice(0, 80)}`).toBe(false);
  });

  it("la lista de ingredientes que queda tiene letras de verdad o está vacía (el catálogo no adivina)", () => {
    for (const p of catalog.products) {
      if (!p.ing) continue;
      const letters = (p.ing.match(/\p{L}/gu) ?? []).length;
      expect(letters / p.ing.replace(/\s/g, "").length, p.code).toBeGreaterThan(
        0.6,
      );
    }
  });
});

describe("isFood: lo que no se come, por categoría y por nombre", () => {
  it.each([
    ["Shampoo anticaída", []],
    ["Jabón líquido", []],
    ["Crema hidratante día", []],
    ["Serum facial", []],
    ["Tratamiento capilar", []],
    ["Detergente líquido", []],
    ["Citrato de magnesio", []],
    ["Creatina", []],
    ["vitamina c", []],
    ["Vitamin D3 2000", []],
    ["Producto raro", ["en:dietary-supplements"]],
    ["Producto raro", ["en:hair-care"]],
    ["Producto raro", ["en:cosmetics"]],
    ["Producto raro", ["en:vitamins"]],
  ])("«%s» %j no es comida", (name, cats) => {
    expect(isFood(cats, name)).toBe(false);
  });

  it.each([
    ["Pasta Cabello de Ángel", []],
    ["Yogurt Griego con Colágeno Hidrolizado", ["en:yogurts"]],
    ["Cápsulas de café Nutresa", []],
    ["Avena Pro con extra Magnesio", []],
    ["Crema de maní con vitamina C", []],
    ["Harina de maíz fortificada con hierro y vitaminas", []],
    ["Choco Krispis", ["en:breakfast-cereals-fortified-with-vitamins"]],
    ["Papas fritas", ["en:potato-skins", "en:snacks"]],
    ["Leche con Omega 3", ["en:milks"]],
  ])(
    "«%s» sí es comida (no se descarta por una palabra suelta)",
    (name, cats) => {
      expect(isFood(cats, name)).toBe(true);
    },
  );
});

describe("cleanIngredients: la tabla del empaque, las direcciones y las instrucciones", () => {
  it("una tabla nutricional sin ingredientes después deja el texto vacío", () => {
    expect(
      cleanIngredients(
        "INFORMACION NUTRICIONAL Porciones por envase: 9 Cantidad por porcion de 200 ml Grasa Total 3 g",
      ),
    ).toBe("");
    expect(
      cleanIngredients(
        "Nutrition Facts Serving Size 2 tbsp Calories 180 %Daily Value",
      ),
    ).toBe("");
  });

  it("con «Ingredientes:» después de la tabla, se queda desde ahí", () => {
    const out = cleanIngredients(
      "Información nutricional Calorías 120 kcal Ingredientes: harina de trigo, azúcar, sal y levadura",
    );
    expect(out).toBe("harina de trigo, azúcar, sal y levadura");
  });

  it("«levadura nutricional» es un ingrediente, no una tabla", () => {
    expect(
      cleanIngredients("avena, levadura nutricional, sal marina"),
    ).toContain("levadura nutricional");
  });

  it.each([
    "680 No. 39F-51 Sur, Bogotá D.C.",
    "Para: KOBA Colombia S.A.S. Parque Industrial del Norte",
    "Hecho en México para Genomm",
    "Industria colombiana",
    "Instrucciones de uso: agregue una cucharadita",
    "Ver lote y fecha de vencimiento en el empaque",
    "Línea de servicio al consumidor",
    "celino Kubitschek de Oliveira, 13.300, /0020-47.",
  ])("«%s» no es lista de ingredientes", (trash) => {
    expect(cleanIngredients(`harina de trigo, azúcar, sal. ${trash}`)).toBe(
      "harina de trigo, azúcar, sal.",
    );
  });

  it("decodifica las entidades HTML que trae Open Food Facts", () => {
    expect(
      cleanIngredients("contiene &quot;maní&quot; y &amp; almendra, sal, agua"),
    ).toBe('contiene "maní" y & almendra, sal, agua');
  });
});

describe("plainName y refineCatalog", () => {
  it.each([
    ["Margarina light en calorias", "Margarina"],
    ["Mayonesa reducida en grasa y calorías", "Mayonesa reducida en grasa"],
    ["Mr.Tea Cero Calorías Durazno", "Mr.Tea Durazno"],
    ["Colombiana Sin Calorías", "Colombiana"],
    ["Yogurt Descremado Light en Calorías", "Yogurt Descremado"],
    ["Galletas de avena", "Galletas de avena"],
  ])("«%s» → «%s»", (name, expected) => {
    expect(plainName(name)).toBe(expected);
  });

  it("refineProduct aplica las mismas reglas que cleanProduct a un producto ya armado", () => {
    const base = {
      code: "7702535016688",
      brand: "Marca",
      cat: ["snacks"],
      add: [],
      alg: [],
      tr: [],
    };
    expect(
      refineProduct({ ...base, name: "Shampoo demo", ing: "" }),
    ).toBeNull();
    expect(
      refineProduct({
        ...base,
        name: "Galletas demo",
        ing: "Calorías 120 kcal",
      })?.ing,
    ).toBe("");
    expect(
      refineProduct({
        ...base,
        name: "Galletas light en calorías",
        ing: "harina, sal, azúcar",
      }),
    ).toMatchObject({ name: "Galletas", ing: "harina, sal, azúcar" });
  });

  it("refineCatalog conserva licencia y fuente, y es idempotente", () => {
    const catalog = {
      generated: "2026-11-22",
      license: LICENSE,
      source: "x",
      products: [
        {
          code: "7702535016688",
          name: "Galletas demo",
          brand: "",
          cat: [],
          ing: "harina, azúcar, sal",
          add: [],
          alg: [],
          tr: [],
        },
        {
          code: "7702535016695",
          name: "Jabón demo",
          brand: "",
          cat: [],
          ing: "",
          add: [],
          alg: [],
          tr: [],
        },
      ],
    };
    const once = refineCatalog(catalog);
    expect(once.products).toHaveLength(1);
    expect(once.license).toBe(LICENSE);
    expect(refineCatalog(once)).toEqual(once);
  });
});
