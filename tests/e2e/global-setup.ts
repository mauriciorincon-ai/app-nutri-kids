import type { FullConfig } from "@playwright/test";

/**
 * ¿Quién contesta en el puerto? — gate de identidad, antes del primer test.
 *
 * Con `reuseExistingServer` (local), si otro proyecto ya tiene tomado el puerto,
 * Playwright lo reutiliza sin decir nada y la suite entera corre contra OTRA app.
 * El síntoma es 60 tests en rojo sin pista — y el riesgo real es el contrario: que
 * la otra app satisfaga por casualidad lo que un test mira, y el gate quede en verde
 * midiendo algo que no es esto. Pasó dos veces el 2026-08-22 (otras dos apps del
 * portafolio en el 3000).
 *
 * Salida: mueve la suite con `E2E_PORT=3111 pnpm test:e2e`.
 */
export default async function verificarQuienContesta(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  const respuesta = await fetch(baseURL).catch(() => null);
  if (!respuesta) return; // no hay nadie: Playwright levantará su propio servidor

  const html = await respuesta.text();
  if (html.includes("Nutri-Kids")) return;

  const titulo = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "(sin título)";
  throw new Error(
    `En ${baseURL} contesta OTRA app: «${titulo}».\n` +
      `Playwright la habría reutilizado y toda la suite mediría la app equivocada.\n` +
      `Corre la suite en otro puerto:  E2E_PORT=3111 pnpm test:e2e`,
  );
}
