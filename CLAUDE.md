# Nutrikids (app-nutri-kids) — constitución de la app (núcleo, kit v2.4.0)

> Auto-cargado en cada sesión de este repo. Esta app pertenece al pipeline **AI-APPs**; su plan vive en la casa planeadora.
> Núcleo regenerado por la planeadora el 2026-11-15 (`/nueva-app nutri-kids` modo regenerar, método y kit v2.4.0) para el S4, que abre la
> construcción del H-2; sustituye a la constitución v1 de 214 líneas (estampada desde kit v1.1.0 el 2026-07-06), cuyo texto íntegro queda en
> `docs/REGLAS-ANEXO.md` § «Nutrikids», junto a las reglas del kit en detalle; el anexo se lee solo cuando una regla se cita, nunca al abrir la sesión.
> Las reglas duras de producto de Nutrikids están aquí, completas. Frase centinela de esta adopción: «el plan vivo, y en casa».

## Identidad y las dos casas (regla dura)

- **Planeadora** (`~/Code/hr01-develop-ai-apps/`, privada): brief, `VISION.md` v1.0.1 (37 funcionalidades: 15 del MVP + 22 del roadmap), la dieta real como contenido de runtime, el archivo del sprint (`portafolio/nutri-kids/sprints/SPRINT_NNN.md`: inicio ejecutivo + plan + arranque), método y estándares. La **lees** (`additionalDirectories` o path absoluto); **nunca escribes ahí**.
- **Esta app** (`~/Code/app-nutri-kids`, pública): código, tests, ADRs, `sprints/SPRINT_NNN-cierre.md`. Escritor único: **tú**. El avance vive solo aquí; la planeadora te lee, tú no le reportas a mano. Si el plan necesita cambio, lo declaras en el cierre ejecutivo («desviaciones») y avisas al usuario.
- **Qué es:** **Nutrikids** — la dieta médica estricta de un niño, viva y compartida: PWA móvil primero (360–420 px), bilingüe ES/EN, que convierte el plan del profesional en guía coloquial con **semáforo de alimentos**, **equivalencias**, calendario de suplementos, el **día** (qué toca, qué comió, qué falta) y un chat que responde **sobre el plan real**. Para todos los que cuidan al niño: que cualquiera abra la app y sepa en segundos qué darle hoy y qué evitar.
- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui · PWA (`public/manifest.webmanifest`, `public/sw.js`, ADR-003) · **local-first** (ADR-001): la dieta, las preferencias y el registro del día viven en el aparato (`nutrikids.*` en `localStorage`) · Zod (`src/lib/diet/schema.ts`, `schemaVersion`) · Vercel (preview por PR, producción desde `main`) · Sentry metadata-only · Vitest 4 + Playwright + Testing Library + @axe-core/playwright.
- **Perfil:** web (ni escritorio ni export estático): la línea siguiente es la declaración del perfil escritorio y aquí no aplica.
  captura_terceros: false
- **Estructura:** `src/app` (Hoy `/` · `dieta` y `dieta/[id]` · `suplementos` · `chat` · `historial` · `cargar` · `perfil` · `ajustes`) · `src/components` (UI sin lógica) · `src/lib/diet/` (`schema` · `logic` semáforo y día · `search` · `answer` chat por código · `migrate` v1→v2 · `profile-notes` lo anotado por quien cuida · `texture` · `storage` · `day-log` · `day-events`, puros; el que se sume entra aquí) · `src/lib/ia/` · `src/i18n/` (es · en, paridad por test) · `data/demo-diet.json` (la ÚNICA dieta del repo: inventada) · `tests/{unit,e2e}` · `design-system.md` · `docs/{MANUAL-DE-USO.md, GUIA-DE-PRUEBA.html, BLUEPRINT.html, BROCHURE.html, brochure-export.json, kit-de-prueba/}` · `decisions/` (ADR numerados desde 001, uno por decisión) · `sprints/` (summaries de la v1; desde el S4, `SPRINT_NNN-cierre.md`).

## Reglas duras de Nutrikids (producto, no estilo — 7, completas)

Numeración de la v1 conservada en 1–4 (el código y los ADR la citan); la 5, 6 y 7 suben de las reglas de la casa para el H-2.

1. **Repo público, niño real: nada de la familia viaja.** Ni nombre, ni contacto, ni edad, ni condición, ni la dieta real: ni en código, fixtures, tests, capturas, commits ni issues. El repo solo lleva `data/demo-diet.json` (inventada, anonimizada). La dieta real (`portafolio/nutri-kids/contenido/`, planeadora) es **contenido de runtime del usuario**: la LEES para validar el schema, **nunca la copias aquí** ni citas su contenido en un mensaje.
2. **Sin calorías, peso, IMC ni percentiles** en UI, datos o copy, en los dos idiomas. Nada de lenguaje de culpa, premio con comida ni «cumplimiento» como calificación moral. Tono positivo y práctico.
3. **Framing no-médico visible:** el aviso permanente («no reemplaza a tu pediatra») es un elemento del sistema de diseño, no letra pequeña; la app acompaña y organiza el plan, nunca diagnostica ni prescribe.
4. **El semáforo nunca comunica solo con color** (símbolo + texto + color, siempre).
5. **Código primero; IA de runtime sin API de pago ni de terceros.** Toda respuesta nace de programación determinista sobre el plan cargado. En el runtime **jamás un API de pago por uso ni un proveedor de terceros**; el orden es: el modelo del sistema que el aparato ya trae → un modelo local embebido → **la feature no existe** y responde el código. Lo generativo fuera del runtime lo opera Claude Code. Ningún SDK de proveedor entra sin ADR «código primero».
6. **Los datos de salud del niño no salen del aparato en claro.** Ni red, ni logs (solo `kind` + conteos), ni Sentry, ni capturas con datos reales. Lo que la familia comparte entre sus aparatos (S7) viaja **cifrado de punta a punta** o no viaja: ningún servidor ni tercero puede leerlo. Un derivado jamás nace menos privado que su fuente (export, impresión, aviso).
7. **Descartar nunca por default.** Todo lo de la VISION se construye (código primero); salir del alcance solo si el dueño lo dice con su nombre. El builder no recorta por tiempo: si no cabe, lo dice y lo planea la planeadora.

## Hito vigente: H-2 «Producto completo» (F0 2026-11-01; entra a la ola el 2026-11-13)

- **Desde el S4.** El H-1 (S1–S3, método v1) quedó construido con huecos que la matriz VISION → código del 2026-11-15 encontró; el H-2 los paga primero. El gate humano de Nutrikids hasta cerrar el H-2 es UNO: el **ensayo general** del dueño (no se ofrece un gate al cerrar sprints).
- **Sale cuando:** el inventario de la VISION v1.0.1 está al 100 % —las 15 del MVP y las 22 del roadmap, cada una **construida o descartada por el dueño con su nombre**— · bilingüe ES/EN completo · servicios reales sin mocks · el despliegue de Vercel como entorno igual al de producción · arquitectura al día · **ensayo general del dueño**: todos los flujos como cliente, con la guía abierta; lo no visto no cuenta.
- **Ninguna feature del H-2 afloja una regla dura.** Las que la rozan (estado compartido, avisos, cámara, chat con IA) se le plantean al dueño como mirada de DECISIÓN, con su ADR, antes de construir; jamás se resuelven en silencio.

## Workflow del sprint (5 pasos)

1. **Plan.** El usuario trae el archivo del sprint de la planeadora (`portafolio/nutri-kids/sprints/SPRINT_NNN.md`). En **plan mode** corres `/plan-sprint`: estado real del código, riesgos, plan en ≤ 3 fases con criterio observable y horas por fase, recomendación de modelo. **La aprobación del plan NO arranca nada:** esperas el **«construye»** explícito. Branch `sprint-NNN/<tema>`.
2. **Construcción.** ≤ 3 fases; commits convencionales con `[F1]` / `[F2]` / `[F3]` en el subject (de ahí salen las horas por fase). **Un solo STOP al final de la construcción**, **más como máximo 1 mirada de DECISIÓN** si el sprint cambia una decisión del usuario, la promesa o su máquina. FORMA y TEXTO se maquetan «no vistas» (registro de una línea) y van al gate humano del hito.
3. **Auditoría de una pasada + checklist manual.** `/audita-sprint` (un auditor independiente en solo lectura, 4 casillas: alcance · calidad · seguridad y privacidad · frases caducadas); **todo hallazgo —crítico, alto, medio o bajo—, código y docs, se paga antes del STOP; lo imposible queda solo con la decisión del dueño escrita en el cierre** (exigencia del usuario 2026-11-08). Luego `/deploy-check`: ≤ 10 casillas — **la CI es el gate; si no está en la CI, no es casilla.**
4. **Cierre ejecutivo.** `sprints/SPRINT_NNN-cierre.md` ≤ 40 líneas con la salida de `node scripts/horas-sprint.mjs` pegada (campos abajo). Reemplaza al summary y al implementation-log.
5. **PR normal** (no en borrador) con el cierre dentro; checks requeridos de la ruleset `main-protegida` (`quality` · `e2e` · `lighthouse`, más `un-pr-vivo` desde que entra) con conclusión propia `success`, leídos **al final**. **Antes de abrirlo, `gh pr list --state open` (regla 18).** Al pedir el merge entregas la lista de PRs abiertos, que debe ser ese uno. **El merge squash lo hace el usuario** y borra la rama; después corre `/cierre-sprint nutri-kids` en la planeadora.

- **Lo técnico lo decides tú** con tu default y lo reportas en el cierre (regla aprobada 2026-11-14): al STOP solo preguntas lo que cambia una decisión del dueño, su promesa o su equipo; un merge sin respuesta acepta tus defaults; un default jamás aplaza un hallazgo a otro sprint.
- **Por hito, no por sprint:** gate humano único (sin tope de tiempo, sobre una guía que es UN recorrido sin pasos repetidos con matriz `cubre: [ids]` y su test; en el H-2, el ensayo general) · brochure · `design-sync` · `docs/BLUEPRINT.html` · pruebas y capturas en el segundo idioma · adopción del kit y de esta constitución (una vez al abrir el hito).
- **Matriz de hitos (método v2.3.0; 4 hitos, ninguno más).** H-1 Vitrina funcional (= MVP) · **H-2 Producto completo** (VISION 100 % construida o descartada con nombre, servicios reales, bilingüe, ensayo general) · H-3 Robustez (persistencia definitiva, cero hallazgos abiertos) · H-4 Producción (= G-Release: legal, observabilidad mínima, smoke). Que la familia use la app en su vida real no es un hito.
- **Lo que ya no se necesita se cierra** (el usuario, 2026-11-02): todo servidor que abras (`dev`, `start`, el `webServer` de Playwright, Lighthouse) escucha en `127.0.0.1`, nunca en todas las interfaces; Nutrikids usa el **3600** (3000 y 3100 son de otras apps, 3200 planlang, 3300 Velo, 3400/3401 Big-D, 3500 Habla). Lo que abres tú lo cierras antes de terminar la fase. Al STOP, `lsof -nP -iTCP -sTCP:LISTEN` no muestra procesos con cwd en este repo y el cierre lo dice en una línea. Un servidor de otra app no lo cierras: lo reportas.
- **Solo por cambio:** aprovisionamiento (solo si hay uno nuevo) · demo en rojo (solo gates propios nuevos) · roadmap de CV Viva (solo si el sprint toca una feature votada) · ADR (solo decisiones irreversibles).
- **Tamaño:** ≈ 4 h activas por defecto; hasta ≈ 12 h con una línea de justificación. Si el real supera el estimado en más del 50 %, el cierre explica la causa y propone una medida.
- **Modelo por DECISIÓN, nunca por descuido (regla dura del usuario, 2026-10-11).** Cada fase declara modelo requerido y esfuerzo **sugerido**; el tope ordinario es **Opus 5.5**; **Fable 5.1 solo en emergencia declarada por el usuario**.

  | Actividad | Modelo requerido | Esfuerzo (sugerido) |
  |---|---|---|
  | Planear sprint, cerrar sprint, preguntas de la planeadora | Opus 5.5 | medium |
  | Checkpoint de hito, decisión irreversible, auditoría del proceso | Opus 5.5 | high |
  | Construcción con alcance claro (interfaz, lógica, pruebas, contenido redactado) | Sonnet 5.5 | medium |
  | Construcción simple: ajustes de interfaz, textos, cambios pequeños | Haiku 5.5 (en prueba, `claude-haiku-5-5`) | medium |
  | Depuración difícil, cifrado, sincronización, seguridad y privacidad | Opus 5.5 | high |
  | Auditoría de una pasada | Sonnet 5.5 | high |
  | Cierre ejecutivo, script de horas, documentación corta | Haiku 5.5 | low |
  | Subagentes de búsqueda o lectura | `Explore` (Haiku 5.5) | medium |

  - **Gate de modelo al abrir cada fase:** tu primera línea es «Fase N · modelo requerido: X · esfuerzo sugerido: E (`/effort E` si tu encabezado muestra otro) · modelo activo: Y». Si coinciden, arrancas; **si no, NO construyes nada** hasta que el usuario escriba «vamos con Y» o cambie con `/model X`. `/model`, `/effort`, `/compact` y `/advisor` los escribe el usuario, uno por mensaje: se los pides en una línea con el comando exacto. Entre fases se usa `/compact`, nunca `/clear`.
  - **Relevo, nunca loop (regla 29):** al segundo intento fallido sobre lo mismo, o a los 20 min sin avance verificable, paras, escribes qué intentaste y pides relevo en una línea: «Relevo: modelo actual X · recomiendo Y · por qué · `/model Y`» (Haiku → Sonnet → Opus; de Opus decide el usuario), cambiando de MÉTODO, no solo de modelo.

## Reglas (29, una línea cada una)

`[sprint]` cuesta en cada sprint · `[hito]` al abrir o cerrar un hito · `[cambio]` solo si el sprint toca lo que cubre · `[siempre]` pasiva. 🔒 = privacidad o seguridad. Detalle: `docs/REGLAS-ANEXO.md § N`; lo propio de Nutrikids, § «Nutrikids».

1. `[siempre]` **TypeScript strict.** Sin `any` ni `@ts-ignore` sin justificación. — § 1
2. `[sprint]` **Tests de lo que cambia.** `src/lib/**` > 80 %, ≥ 1 e2e por feature core que llega POR LA UI; **fechas siempre mockeables** (suplemento de hoy, registro del día y vigencias dependen del día). — § 2
3. `[siempre]` **Motor separado de UI.** `lib/diet/` es puro (semáforo, día, búsqueda, respuestas del chat); los componentes no deciden. — § 3
4. `[siempre]` **La dieta = datos versionados con schema:** todo contenido nutricional entra por `schema.ts` (`schemaVersion`, migración probada al subirla); el import FALLA si está malformado; ningún alimento ni regla escritos en un componente. Toda salida de IA que se persista pasa por Zod. — § 4
5. `[siempre]` **A11y desde el inicio:** contraste AA, aria-labels, táctil ≥ 44 px, `prefers-reduced-motion`; el color nunca solo. — § 5
6. `[siempre]` **Commits convencionales**; branch `sprint-NNN/<tema>`; jamás push directo a `main` (hook); ruleset `main-protegida`; un job de CI nuevo entra a la ruleset en el mismo sprint. — § 6
7. `[siempre]` 🔒 **Secrets solo en `.env.local` y Vercel env;** gitleaks a doble cinturón (hook + `githooks/pre-commit`); se prueba con la carnada canónica del anexo § 7, nunca improvisada. En esta app el gate es doble: secrets Y datos personales (regla dura 1). — § 7
8. `[sprint]` **Presupuesto medido:** ≈ 4 h, ≤ 12 h con justificación; horas con `scripts/horas-sprint.mjs`; ~12 pasos por pantalla. — § 8
9. `[sprint]` **Manual de uso vivo** (`docs/MANUAL-DE-USO.md`, en los dos idiomas): toda feature que llega a `main` tiene su sección en el mismo sprint, para quien cuida, en llano. — § 9
10. `[hito]` **El diseño va antes del código:** la fuente de verdad visual es `design-system.md` (cálido, familiar, calmado; ni clínico ni gamificado), que se extiende por ADR; solo **DECISIÓN** abre parada (máx. 1 por sprint); FORMA y TEXTO al gate del hito. — § 10
11. `[cambio]` **Guía de prueba viva** (`docs/GUIA-DE-PRUEBA.html`, autocontenida, origen por línea): se toca solo si el sprint cambia un flujo visible; al cierre del hito es UN recorrido por el día de una familia, sin pasos repetidos, con la matriz `cubre: [ids]` y su test. — § 11
12. `[siempre]` **Prohibido entregar por artifacts o plataformas externas:** todo entregable es un archivo del repo y se entrega su ruta. — § 12
13. `[hito]` **Brochure** (`docs/BROCHURE.html` en `/conoce` + `docs/brochure-export.json`, contrato `brochure-export` v1.0.0): todo sprint que cambie una feature lo ajusta en su mismo PR. — § 13
14. `[siempre]` **Código primero, IA generativa después:** feature LLM ⇒ ADR «código primero»; la IA es acento con fallback determinista (regla dura 5). — § 14
15. `[cambio]` **Un gate se demuestra fallando** (`scripts/demo-rojo.sh`, solo gates propios nuevos); `skipped` no es verde. — § 15
16. `[hito]` **El bundle de `design-sync`** (`.design-sync/`) es un artefacto del repo y se actualiza al cierre del hito. — § 16
17-bis. `[siempre]` **Lo que la app escribe también es superficie:** un derivado jamás nace menos privado que su fuente (regla dura 6). — § 17-bis
17. `[siempre]` 🔒 **Cero enlaces:** ningún archivo versionado ni campo de GitHub publica la URL de producción o de previews (homepage del repo = el propio repo (Vercel solo rellena el campo vacío: jamás se vacía con `--homepage ""`, kit v1.32.1; fijado por la planeadora el 2026-11-15)); el barrido es un paso del job `quality` (`scripts/cero-enlaces.mjs`, hosts en `cero-enlaces.json`). — § 17
18. `[siempre]` **UN SOLO PR VIVO POR APP (regla dura 2026-10-11).** Dependabot cuenta; `gh pr list --state open` antes de abrir; un segundo PR solo si su cuerpo EMPIEZA con «complementa #N: <por qué>»; job `un-pr-vivo`; dependencias agrupadas (`scripts/verificar-dependencias.mjs`). — § 18
19. `[cambio]` **Todo puente entre dos lenguajes o dos procesos exige su gate de contrato** (el service worker ↔ la página; el aparato ↔ el servicio de sincronización). — § 19
20. `[siempre]` **Bilingüe ES/EN en todo:** el dato nace como mapa `{ es, en }`, redactado (no traducido), con test de paridad de claves; e2e y capturas en UN idioma por sprint, el otro al cierre del hito. Conversación y cierres en español; código, commits y ADRs en inglés. — § 20
21. `[cambio]` **IA de construcción por suscripción (7-S):** solo el binario oficial de Claude Code, token jamás en env, trazas ni repo; la suscripción jamás procesa peticiones de terceros. — § 21
22. `[cambio]` **Todo control dibujado tiene su script cargado;** la pasada de capturas activa cada control tocado. — § 22
23. `[cambio]` **Matriz de envejecimiento:** vigencias, suplemento del día y restricciones con fecha dependen del día: la fecha es perilla de prueba, nunca el reloj; la demo jamás «caduca». — § 23
24. `[cambio]` 🔒 **Las protecciones del sistema del usuario se enseñan antes de tocarlas:** matriz por acción y un «sí» por acción (permisos de notificaciones y cámara incluidos). — § 24
25. `[siempre]` **El comando de pruebas por defecto no toca hardware ni permisos;** lo real, solo en el ensayo. — § 25
26. `[siempre]` **Worktrees prohibidos:** todo ocurre en `~/Code/app-nutri-kids`; nada de `git worktree` ni `git stash` a secas; se agrega por ruta, jamás `git add -A`. — § 26
27. `[siempre]` **La evidencia se escribe después del hecho** («N de N», «en verde») con la cuenta tomada del resultado. — § 27
28. `[cambio]` **Parejas de versiones entre dos ecosistemas:** no aplica hoy. — § 28
29. `[siempre]` **Relevo, nunca loop** (arriba, en «Modelo por DECISIÓN»). — § 29

## Cierre ejecutivo (`sprints/SPRINT_NNN-cierre.md`, ≤ 40 líneas)

Frontmatter `sprint · app · hito · opened · closed · branch · pr`, y los campos, una línea o tabla corta cada uno: nombre · objetivo · resultado · estado ·
tiempo estimado · tiempo real (salida de `scripts/horas-sprint.mjs`) · diferencia · fases y horas por fase · entregables · no completado · desviaciones y causas ·
decisiones · deuda (solo lo imposible, con `archivo:línea` y la decisión del dueño escrita) · aprendizajes · recomendación · esfuerzo-beneficio ·
**auditoría** (4 casillas; cada hallazgo con `pagado · <commit>`) · si una fase se pasó > 50 %: causa y medida · **modelo por fase y desvío** · **relevos** ·
servidores al STOP («`lsof` LISTEN en este repo: 0») · «Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`».

## Comandos

`/plan-sprint` · `/audita-sprint` · `/deploy-check` · `/design-sync` (hito; lo invoca el usuario) · `/self-review`, `/run-tests`, `/security-audit` (opcionales). Del kit v2.4.0 (desde el S4):
`scripts/horas-sprint.mjs` · `scripts/cero-enlaces.mjs` + `cero-enlaces.json` · `scripts/demo-rojo.sh` · `scripts/verificar-dependencias.mjs` · `.github/workflows/un-pr-vivo.yml`.
Propios: `scripts/validate-diet.ts` (valida un JSON de dieta contra el schema) · `scripts/sync-brochure.mjs` · `scripts/generate-icons.mjs` · `scripts/check-sentry.mjs`.

## Estándares (los 6+1, gates en CI)

Testing · CI/CD · Observabilidad (metadata-only: jamás contenido de la dieta ni del registro, solo `kind` + conteos) · Seguridad · Performance (`perf-budget.json`) · UX+A11y ·
**IA embebida responsable** (solo si un modelo del sistema o local entra por ADR). Detalle: `estandares/estandares.md` de la planeadora. Ítem rojo ⇒ deuda explícita en el cierre o el sprint no cierra.

## Patrones de dominio de esta app

- **Semáforo como lenguaje central:** `logic.ts` resuelve verde/amarillo/rojo de cualquier ítem consultando SOLO los datos cargados; la UI lo presenta con símbolo + texto + color y el «por qué» en palabras simples.
- **El chat responde con código:** «¿se puede X?», «no tengo X», «no quiso X», «¿qué le doy ahora?» se contestan desde el semáforo, las equivalencias, el menú y la hora; lo que el plan no dice, se dice que no lo dice («consúltalo con tu profesional»), jamás se inventa.
- **El día por fecha:** `day-log.ts` persiste marcas con clave `YYYY-MM-DD`; amanece vacío cada día sin borrar el historial; «Borrar datos» limpia todo.
- **Demo ↔ real:** la app funciona completa con `data/demo-diet.json`; la dieta real se importa en runtime y vive solo en el aparato; un aviso siempre visible dice cuál está activa.

# Compact instructions

Al compactar conserva: el archivo del sprint (`SPRINT_NNN.md`) como manifiesto, la fase en curso y su modelo, las rutas tocadas con su último commit,
las decisiones del dueño y los defaults que rigen, los gates en rojo con su causa y lo que falta para el STOP.
Descarta salidas de herramientas, contenidos de archivos ya leídos y diffs: se releen si hacen falta.

Constitución núcleo kit v2.4.0 — Nutrikids, regenerada 2026-11-15 para el S4 (H-2). Las reglas del kit en detalle y el texto íntegro de la v1 viven en docs/REGLAS-ANEXO.md.
