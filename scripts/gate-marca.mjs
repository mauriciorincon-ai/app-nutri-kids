#!/usr/bin/env node
// kit v2.5.0 — regla 10 (la marca la decide el dueño, ANTES de construir encima). Exigencia del dueño 2026-11-23 (AI-Jobs
// PR #4: el builder escribió design-system.md y 23 pantallas sin que él viera la marca; ya había pasado en Velo y en
// AngelGhost). Lo visual y de marca NUNCA es «default técnico»: este gate lo vuelve mecánico.
//
// Regla: si el índice de git trae `design-system.md` o una pantalla de la maqueta (`docs/diseno/**.html`, salvo la propia
// página de marca), debe existir `docs/diseno/MARCA.md` con la aprobación del dueño:
//   estado: aprobada · aprobada_el: AAAA-MM-DD · direccion: <la elegida> · frase_del_dueno: "<su frase literal>"
//   marca_sha256: <sha256 de docs/diseno/marca.html tal como él la vio>   (si la página cambia, hace falta otra aprobación)
// o, en apps cuyo G-Diseño es anterior a esta regla: estado: heredada · g_diseno: AAAA-MM-DD.
// Corre sobre el ÍNDICE (`git ls-files`, `git show :ruta`): en el hook pre-commit ve lo que se va a commitear; en la CI, el árbol.
// Uso: node scripts/gate-marca.mjs [--cwd <dir>]        Salida 0 = pasa · 1 = bloqueado (con la razón)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const REGISTRO = "docs/diseno/MARCA.md";
export const PAGINA_MARCA = "docs/diseno/marca.html";

/** «continúa» no aprueba diseño (regla 10): una frase que solo deja seguir no es una aprobación de marca. */
const NO_APRUEBAN = new Set(["continua", "continúa", "sigue", "ok", "okay", "dale", "listo", "vamos", "si", "sí", "va", "bien"]);

/** Lo que exige la aprobación: lo que fija la marca y lo que se construye encima de ella. */
export function esDisenoConstruido(ruta) {
  if (ruta === "design-system.md" || ruta.endsWith("/design-system.md")) return true;
  if (!ruta.startsWith("docs/diseno/") || !ruta.endsWith(".html")) return false;
  return ruta !== PAGINA_MARCA && !ruta.startsWith("docs/diseno/marca/");
}

/** Frontmatter YAML plano (clave: valor), sin dependencias. */
export function leerFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto ?? "");
  if (!m) return null;
  const campos = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_0-9]+):\s*(.*)$/.exec(linea.trim());
    if (kv) campos[kv[1]] = kv[2].trim().replace(/^["'«](.*)["'»]$/, "$1").trim();
  }
  return campos;
}

const fecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

/** Valida el registro. Devuelve la razón del bloqueo, o null si la aprobación vale. */
export function validarRegistro(campos, shaPaginaActual) {
  if (!campos) return `${REGISTRO} no tiene frontmatter (--- … ---)`;
  if (campos.estado === "heredada") {
    return fecha(campos.g_diseno) ? null : `${REGISTRO}: «heredada» exige g_diseno: AAAA-MM-DD (el G-Diseño anterior a la regla)`;
  }
  if (campos.estado !== "aprobada") {
    return `${REGISTRO}: estado «${campos.estado ?? ""}»; la marca no está aprobada por el dueño`;
  }
  if (!fecha(campos.aprobada_el)) return `${REGISTRO}: falta aprobada_el: AAAA-MM-DD`;
  if (!campos.direccion) return `${REGISTRO}: falta direccion (la que eligió el dueño)`;
  const frase = (campos.frase_del_dueno ?? "").trim();
  const desnuda = frase.toLowerCase().replace(/[¡!¿?.,;:«»"'\s]+/g, " ").trim();
  if (!frase || NO_APRUEBAN.has(desnuda)) {
    return `${REGISTRO}: frase_del_dueno vacía o que solo deja seguir («${frase}»); la aprobación es su frase sobre la marca`;
  }
  if (!shaPaginaActual) return `${REGISTRO}: aprobada, pero ${PAGINA_MARCA} no está en el repo (lo que el dueño vio)`;
  if (campos.marca_sha256 !== shaPaginaActual) {
    return `${REGISTRO}: marca_sha256 no coincide con ${PAGINA_MARCA}; la página cambió después de la aprobación → nueva mirada de marca`;
  }
  return null;
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function contenidoEnIndice(ruta, cwd) {
  try {
    return execFileSync("git", ["show", `:${ruta}`], { cwd, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/** Corre el gate sobre el índice de `cwd`. Devuelve { ok, razon, disenos }. */
export function evaluar(cwd = process.cwd()) {
  const rutas = git(["ls-files", "-z"], cwd).split("\0").filter(Boolean);
  const disenos = rutas.filter(esDisenoConstruido);
  if (disenos.length === 0) return { ok: true, razon: null, disenos };
  const registro = contenidoEnIndice(REGISTRO, cwd);
  if (!registro) {
    return { ok: false, razon: `falta ${REGISTRO}: hay diseño construido sin la aprobación de marca del dueño`, disenos };
  }
  const pagina = contenidoEnIndice(PAGINA_MARCA, cwd);
  const sha = pagina ? createHash("sha256").update(pagina).digest("hex") : null;
  const razon = validarRegistro(leerFrontmatter(registro.toString("utf8")), sha);
  return { ok: razon === null, razon, disenos };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const i = process.argv.indexOf("--cwd");
  const { ok, razon, disenos } = evaluar(i > -1 ? process.argv[i + 1] : process.cwd());
  if (ok) {
    console.log(`gate-marca: pasa (${disenos.length} archivo(s) de diseño con la marca aprobada, o ninguno)`);
    process.exit(0);
  }
  console.error(`gate-marca: BLOQUEADO — ${razon}`);
  console.error(`  diseño construido: ${disenos.slice(0, 5).join(", ")}${disenos.length > 5 ? ` y ${disenos.length - 5} más` : ""}`);
  console.error(`  Qué hacer: la mirada de marca (regla 10). Entregas ${PAGINA_MARCA}, el dueño elige con SU frase y la escribes`);
  console.error(`  en ${REGISTRO} con marca_sha256. Escribir una aprobación que él no dio viola una regla dura.`);
  process.exit(1);
}
