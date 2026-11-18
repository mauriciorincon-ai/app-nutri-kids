---
sprint: 010
app: nutri-kids
hito: H-2
tipo: informe-de-incidente
fecha: 2026-11-17
prs: [16, 17]
para: planeadora (/cierre-sprint nutri-kids)
---

# S10 · Informe: lo que costó hacer pasar el PR

Complementa a `SPRINT_010-cierre.md`. El cierre dice qué se entregó; este informe dice por qué hacer pasar la CI
costó más que construir el sprint, y qué podría cambiar en el método para que no se repita. Lo que se propone
aquí lo decide la planeadora; el builder no escribe en ella.

## 1. En una línea

El sprint se construyó en **2,1 h activas**. Hacer pasar su CI tomó **3 h 17 min de reloj medidos en GitHub**
(PR #16 abierto 18:36 → PR #17 mergeado 21:53, hora local), más el tiempo previo de la sesión con Haiku, que
git no registra. En total fueron **14 corridas de CI, 10 en rojo**. Hicieron falta **dos PR** para un solo sprint,
y `main` quedó en rojo entre los dos merges.

## 2. Cronología (hora local, UTC−5)

| Hora  | Qué pasó                                                                                                                                                             | CI                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 18:36 | PR #16 abierto (cierre con Haiku 5.5). La auditoría de dependencias falla: picomatch GHSA-fc5q-39xc-vjpf (alta), **sin versión arreglada publicada**.                | 4 corridas en rojo              |
| 18:43 | Haiku pone un _ignore_ documentado.                                                                                                                                  | rojo (e2e)                      |
| 18:56 | Se le da más tiempo a una e2e de bienestar (12 pasadas de axe). #16 en verde.                                                                                        | verde                           |
| —     | El dueño pide **solucionar de verdad** picomatch («pase lo que pase»). Relevo a Opus 5.5.                                                                            |                                 |
| 19:16 | **El #16 se mergea** mientras el parche estaba en curso. El trabajo pasa a una rama nueva y al PR #17.                                                               |                                 |
| 19:24 | #17: parche propio a picomatch 2.3.2 y 4.0.7, con prueba. La CI corre pasada la medianoche UTC y **3 pruebas atadas al reloj fallan**; por eso `main` queda en rojo. | rojo (quality)                  |
| 19:30 | Se fija el reloj en esas pruebas. Vercel falla: instala con **pnpm 10**, que calcula distinto la huella del parche, y se le fija pnpm 11.                            | rojo (lighthouse)               |
| 19:54 | Tailwind leía `patches/` y metía una clase `.collapse` suelta en el CSS: se excluye.                                                                                 |                                 |
| 20:08 | Lighthouse: Hoy al borde del tope de bloqueo (306–310 ms vs 300). **Hipótesis mía sin medir en el runner:** iniciar Sentry en reposo. Empeora a 393 ms.              | rojo                            |
| 20:24 | /historial a 441,6 KB de script (tope 440): el enlace a Bienestar deja de precargar.                                                                                 | rojo (TBT)                      |
| 20:36 | **Segundo intento fallido, regla 29:** paré, revertí y pregunté al dueño.                                                                                            | verde por azar (ver § 3.6)      |
| 20:47 | El dueño elige «aligerar Hoy». Mido en el mismo runner con un desglose temporal.                                                                                     | rojo (lint del script temporal) |
| 21:10 | Tres arreglos sin cambio visible. Hoy baja de 247–463 a **137–170 ms**.                                                                                              | verde                           |
| 21:27 | Corrijo una frase falsa del cierre («LISTEN: 0»).                                                                                                                    | verde                           |
| 21:53 | El dueño mergea el #17.                                                                                                                                              |                                 |

## 3. Causas raíz (por qué tardó, no solo qué falló)

1. **Una alerta externa sin arreglo publicado.** picomatch publicó la alerta sin versión corregida, y el PR
   de arriba no cubre `+(*a)`. Nada del sprint la causó, pero la CI la bloquea, y bien. Pagarla de verdad
   exigió escribir y probar un parche propio para dos versiones. La auditoría de pnpm lo sigue viendo por
   número, así que el _ignore_ queda atado al parche.
2. **El modelo asignado no correspondía al trabajo.** La tabla pone el cierre con Haiku. Cuando la CI se
   pone roja al abrir el PR, el trabajo pasa a ser depuración y seguridad, que la tabla asigna a Opus. El
   cambio llegó tarde, cuando el dueño lo pidió.
3. **Merge mientras había trabajo anunciado en curso.** El #16 se mergeó en verde, pero con el _ignore_ que
   el dueño había pedido quitar. Eso abrió un segundo PR, obligó a cherry-picks y dejó `main` en rojo.
4. **Pruebas que leían el reloj real (falta latente a la regla 23).** Tres pruebas (de
   `wellbeing-ui.test.tsx`, del S10, y de `family-controller.test.tsx`, del S9) dependían de la fecha del
   sistema a través de `src/lib/family/local.ts:21` y de `src/components/wellbeing/food-log.tsx`. Pasaban hasta
   las 23:59 UTC. Ningún gate lo detecta: aparecieron solo porque la CI corrió después de medianoche. La
   auditoría del S10 tampoco las vio. Aparte, el centinela de franja de `family-roles.test.ts` buscaba `3-4`,
   que el texto cifrado puede contener por azar.
5. **Vercel no instala igual que la CI.** El proyecto toma pnpm 10 por su fecha de creación; la CI usa pnpm 11. Era invisible hasta que hubo un parche en `patchedDependencies`. Ahora `vercel.json` lo fija.
6. **El presupuesto de rendimiento estaba al borde desde el S10, y es ruidoso.** El S10 sumó a Hoy cerca de
   un 7 % de trabajo, sin medirlo en el runner. El tope de bloqueo es 300 ms y Lighthouse CI se queda con la
   **mejor de 3 corridas**. Con el mismo código, el runner dio 247, 293, 357 y 463 ms; una corrida pasó en
   verde (20:36) sin ningún arreglo. Medir en mi Mac engaña: es ~1,8× más rápido que el runner.
7. **Mis errores, cada uno con su costo:**
   - Probé la hipótesis de Sentry en la CI sin medirla antes: 3 corridas.
   - Una medición «antes del S10» fue inválida: había un archivo sin commit al cambiar de rama.
   - Cambiar de commit dejó `node_modules` corrupto. Hubo que reinstalar; la prueba del parche lo detectó.
   - Medí en local contra un servidor viejo que seguía escuchando en el 3600, y por un momento creí una
     mejora que no existía. Lo detecté antes de reportarlo.
   - El script temporal de diagnóstico no pasaba el lint: 1 corrida.
   - El cierre afirmaba «LISTEN en este repo: 0» y no era literal: 1 corrida para corregirlo.

## 4. Qué quedó arreglado (todo en `main`)

- **picomatch**: parche propio (`patches/`, `pnpm-workspace.yaml`) y prueba
  `tests/unit/picomatch-redos.test.ts`. La prueba sigue las cadenas reales de dependencias y falla si una copia
  cargada no lleva el parche o es lenta. El peor caso bajó de minutos a 1 ms.
- **Reloj**: las 3 pruebas fijan la fecha; el centinela de franja va entre comillas. Pasan en UTC, UTC+14 y UTC−11.
- **Vercel**: `vercel.json` instala con pnpm 11.10.0, como la CI.
- **CSS**: Tailwind no lee `patches/`; el build quedó idéntico a `main` antes del parche.
- **/historial**: 432,7 KB de script (tope 440).
- **Hoy**, sin subir el presupuesto, sin quitar trazas y sin cambio visible:
  - `src/lib/format.ts` crea los formateadores de hora y de orden una vez por idioma; antes, uno por
    comida y por render. Lo prueba `tests/unit/format.test.ts`.
  - El plan B resuelve el semáforo de toda la dieta solo al abrir «se acabó…».
  - `src/components/diet-provider.tsx` y `src/app/page.tsx` pasan por `useDeferredValue` el re-render que
    React forzaba al hidratar. Esa tarea larga bajó de 131–148 ms a 69–72 ms.
- **Al merge**: vitest 1190/1190, cobertura de líneas 97,02 %, e2e 252 verdes y 2 omitidas, y los checks
  `quality` · `e2e` · `lighthouse` · `un-pr-vivo` en `success` sobre el último commit (`c1ddaf0`).

## 5. Lo que sigue frágil

- **Bloqueo de Hoy:** 137–170 ms en el runner, con margen. Pero la carga inicial del JavaScript sigue siendo
  una tarea de ~290 ms en el runner, y la mayor parte es construir los esquemas Zod. Cada sprint que sume
  código al arranque se come ese margen.
- **/ajustes**: queda a 0,5 KB del tope de 440 KB de script.
- **picomatch**: el parche hay que quitarlo cuando salga la versión arreglada. pnpm fallará solo, por parche
  sin usar.

## 6. Propuestas para la planeadora (no las decide el builder)

1. **Tabla de modelos:** «CI roja al abrir el PR» cuenta como depuración y va a Opus desde el primer fallo, no
   desde el segundo.
2. **No mergear con trabajo anunciado en curso:** si el builder dijo que sigue en el PR, el merge espera su
   «listo» o se avisa antes.
3. **Regla 23 con dientes:** un gate que corra las pruebas unitarias con el reloj del sistema corrido (por
   ejemplo, 23:59 en UTC+14 y 00:01 en UTC−11). Así una prueba atada al día real falla en la CI de inmediato,
   y no solo cuando la CI pasa la medianoche.
4. **Rendimiento medido en el runner dentro del sprint:** cuando el sprint toca una pantalla del presupuesto,
   un criterio de fase como «TBT ≤ 250 ms en el runner» (margen sobre el tope de 300), medido antes de abrir el PR.
5. **Kit:** traer al kit el `vercel.json` con `installCommand` de pnpm 11 para las apps con pnpm 11. Traer
   también, si se quiere, una herramienta de traza local con la CPU frenada ×7, que imita al runner (la usé
   para este diagnóstico; hoy no está en el repo).
6. **Aprendizaje para el portafolio:** en React 19, un `Intl.*` creado en cada render y los
   `useSyncExternalStore` que cambian al hidratar producen tareas largas que no se ven en local. Formateadores
   creados una vez y `useDeferredValue` en los proveedores los quitan sin cambio visible.

## 7. Pendiente del dueño

- **Cita de la OMS 2019:** aceptar la cita por sección o dar el PDF para fijar la página
  (`src/lib/wellbeing/references.ts`).
- **Servidor de pruebas de Playwright de VS Code (PID 70525):** escucha con cwd en este repo. No lo abrió el
  builder, así que solo se reporta.
- **Nota para `/cierre-sprint`:** el frontmatter del cierre dice `pr: 16`, pero la CI se pagó en el **#17**,
  que también es parte del S10.
