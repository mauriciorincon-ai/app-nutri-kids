---
sprint: 013
app: nutri-kids
hito: H-2
opened: 2026-11-22
closed: 2026-11-24
branch: sprint-013/etiquetas
pr: 22
---

# S13 · Etiquetas y súper — cierre

- **Objetivo:** leer la etiqueta por foto y el modo súper (VISION.md:70 y :72). **Estado:** PR #22, CI verde en `d00dff7` (último cambio de código).
- **Resultado:** `/camara/etiqueta` (lector), `/camara/super` (escáner, marcas aptas), «Lo que compré», Ajustes «Lector y catálogo». Catálogo Open Food Facts Colombia (ODbL): 8.850 productos, 1.896.823 bytes, 18 % con ingredientes (antes 9.027).
- **Tiempo:** estimado 6,5 h · real 7,4 h (`horas-sprint.mjs`, 32 commits, 3 sesiones, es un piso) · diferencia +0,9 h (+14 %). F1 2,7 h · F2 0,9 h · F3 3,9 h.
- **Lector (10 etiquetas inventadas, Chromium):** 10/10 a 1600 px en dos series; 9/10 a 2000 px; 0 falsos «no vi nada que choque»; 0 peticiones al leer.
- **No completado:** fotos reales de pasillo y lector en teléfono real: ensayo general (decisión del dueño, 2026-11-22). Deuda en `src/lib/label/ocr-client.ts:127`.
**Desviaciones**
- Catálogo por CSV del volcado de Colombia, no por la API (la API corta a 10 páginas).
- F1: Opus falló dos veces con el presupuesto de script (440 KB); relevo a Fable por emergencia del dueño; método: anclar `allergen-families` al cascarón (`5e80e59`).
- CI roja ×3: `quality` (pruebas leían `public/ocr` antes del build) → `de275f2`; `lighthouse` CLS 0,128 en `/camara/super` → `86f4c41` (0,0002); `lighthouse` TBT 385 ms en `/lonchera` y 317 ms en `/recetas` por el re-render síncrono de `useSyncExternalStore` tras hidratar → `d00dff7` (`useDeferredValue`; 202→111 y 256→149 ms a 6× CPU). CI verde después.
- Script: Lighthouse (gate de la CI, 440 KB) pasa en las 16 rutas. El medidor estático `static.mjs` da 473,7 KB en `/camara` (rama) y 475,5 KB en `/recetas` (main). Discrepancia sin resolver; default: Lighthouse es el gate.
**Decisiones (defaults míos)**
- Foto a 1600 px en el lado mayor (2000 px dio 9/10, `7dd7d5e`). Rojo o alergia en trazas → No va; intolerancia en trazas → Revisa (`91d4a90`).
- Tipo nuevo `similar` y modo `--refine` del catálogo (no estaban en el plan). Marcas aptas solo si el producto no encaja (`e8a2790`).
- Cámara por input de archivo, sin vídeo en vivo: la regla 24 no se toca.
**Auditoría** (una pasada, Sonnet, solo lectura; 19 hallazgos: 0 C · 3 A · 8 M · 8 B)
- A: Q1 `91d4a90` · Q5, Q6 `284c94a`. M: Q2, Q3, Q4 `91d4a90` · Q7 `284c94a` · S1 `c2d58bc` · docs F1/F2/F3 `b03f204`. B: S2 `c2d58bc` · C1, C3–C6, A-1 `e8a2790`.
- C2 (barra inferior sobre captura de página completa): **descartado con evidencia**: capturas de viewport al final de `/camara/super`, `/camara/etiqueta` y `/ajustes`, en claro y oscuro; la barra no tapa contenido.
**Modelo, relevos, compact**
- Opus 5.5 (F1) → Fable (emergencia del dueño) → Opus 5.5 · Sonnet 5.5 (F2 y F3) → Opus 5.5 (CI roja 1 y 3) → Haiku 5.5 (cierre).
- `/compact`: 2 pedidos por mí (cierres de F1 y F2); el dueño corrió al menos 4; el conteo exacto no lo tengo.

**Dependencias** (publicadas hace más de 14 días): tesseract.js 7.0.0 (2025-12-15, Apache-2.0); @tesseract.js-data/spa y eng 1.0.0 (2023-09-04, MIT); zxing-wasm 3.1.6 (2026-10-19, MIT). No entró la 3.1.7 (2026-11-15).
**Commits, servidores, PR**
- 32 commits: F1 10, F2 4, F3 18 (3 del TBT temporal, borrado en `659f3e5`). Añadidos por ruta. TBT (mediana de 10, medido antes de `d00dff7`): ninguna ruta peor que main salvo ruido; `/lonchera` y `/recetas` los verifica después el lighthouse de la CI (pasa).
- `lsof` LISTEN: 0 procesos de este sprint con cwd en el repo (cerré un Playwright de hace 7 días). Sin cerrar, de otras apps: VS Code y el host de Claude Code.
- Recomendación: mergear; en el ensayo general, probar lector y escáner con fotos y teléfono reales.

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
