---
sprint: 013
app: nutri-kids
hito: H-2
opened: 2026-11-22
closed: 2026-11-23
branch: sprint-013/etiquetas
pr: 22
---

# S13 · Etiquetas y súper — cierre ejecutivo

- **Objetivo:** leer la etiqueta por foto y el modo súper (VISION.md:70 y :72).
- **Resultado:** `/camara/etiqueta` (lector), `/camara/super` (escáner, marcas aptas), «Lo que compré» y «Lector y catálogo» en Ajustes. Estado: PR #22, CI verde en `86f4c41`.
- **Tiempo:** estimado 6,5 h · real 6,5 h (`scripts/horas-sprint.mjs`, 28 commits, 2 sesiones; es un piso) · diferencia 0 h. Fases: F1 2,7 h · F2 0,9 h · F3 3,0 h.
- **Entregables:** lector tesseract.js 7.0.0 en `/ocr/` (ES/EN, se baja al tocar, 9,1 MB, caché propia del SW); cotejo puro `src/lib/label/check.ts` (No va · Revisa · No vi nada que choque · No pude leerla, siempre con «verifícalo con un adulto» y el texto leído); escáner BarcodeDetector o zxing-wasm 3.1.6 en worker; catálogo Open Food Facts Colombia (ODbL, atribución en Ajustes): 8.850 productos, 1.896.823 bytes, 18 % con ingredientes (1.619; antes 9.027, poda de la auditoría); ADR-019, manual ES/EN, guía, brochure (39 funcionalidades).
- **Lector (10 etiquetas inventadas, Chromium, lector real):** 10/10 a 1600 px en dos series; 9/10 a 2000 px (la dura da «no pude leerla»); 0 falsos «no vi nada que choque»; 0 peticiones al leer.
- **No completado:** fotos reales de pasillo y lector en teléfono real. Deuda en `src/lib/label/ocr-client.ts:127`; decisión del dueño (2026-11-22): ensayo general.

## Desviaciones y causas

- Catálogo por CSV del volcado de Colombia, no por la API (la API corta a 10 páginas). El plan decía API.
- F1: Opus falló dos veces con el presupuesto de script (440 KB). Relevo a Fable por emergencia del dueño; método: anclar `allergen-families` al cascarón (`src/components/app-shell/shell-pins.ts`, `5e80e59`).
- CI roja ×2: (1) `quality`, las pruebas leían `public/ocr` antes del build → `de275f2`; (2) `lighthouse`, CLS 0,128 en `/camara/super` → `86f4c41` (0,0002; mismo patrón en el lector). `/lonchera` dio 367 ms de TBT una vez (límite 300); main dio 369 en ese runner y la corrida siguiente pasó.
- Medición de script: Lighthouse (gate de la CI, `perf-budget.json` 440 KB) pasa en las 16 rutas. El medidor estático `static.mjs` da 473,7 KB en `/camara` (rama) y 475,5 KB en `/recetas` (main, misma medición). Discrepancia sin resolver; default: Lighthouse es el gate del kit.

## Decisiones (defaults míos)

- Foto a 1600 px en el lado mayor (`7dd7d5e`); a 2000 px dio 9/10.
- Rojo en trazas → No va; alergia en trazas → No va; intolerancia en trazas → Revisa (`91d4a90`).
- Tipo de hallazgo nuevo `similar` y modo `--refine` del catálogo (no estaban en el plan).
- Marcas aptas solo si el producto no encaja; nunca «revisa» ni «no pude» (`e8a2790`).
- `/ocr/`, `/scan/`, `/catalogo/` en cachés propias del SW; tesseract sin caché propia (`cacheMethod: none`).
- Cámara por input de archivo, sin vídeo en vivo: la regla 24 no se toca.

## Auditoría (una pasada, Sonnet, solo lectura; 19 hallazgos: 0 C · 3 A · 8 M · 8 B)

- A: Q1 códigos con espacios y comas `91d4a90` · Q5 no-comida y suplementos `284c94a` · Q6 tabla nutricional y calorías en el catálogo `284c94a`.
- M: Q2 letras por cifras `91d4a90` · Q3 yogur/yoghurt y plurales `91d4a90` · Q4 marcador de trazas y rojo en trazas `91d4a90` · Q7 direcciones y contactos en el catálogo `284c94a` · S1 «Borrar datos» nombra lo que borra `c2d58bc` · F1/F2/F3 docs (frase «todavía no lee», métricas, MB) `b03f204`.
- B: S2 confirmación al borrar `c2d58bc` · C1, C3, C4, C5, C6 y A-1 (chip, «Puede llevar», «Anotado», marcas aptas) `e8a2790` · C2 barra inferior sobre captura de página completa: **descartado con evidencia** (capturas de viewport al final de `/camara/super`, `/camara/etiqueta` y `/ajustes`, en claro y oscuro: la barra no tapa contenido).
- Fuera de la auditoría: prueba intermitente de avisos (S8), observada en F1 → `62f62a5`.

## Modelo, relevos y compact

- Modelo por fase: F1 Opus 5.5 → Fable (emergencia del dueño) → Opus 5.5 · F2 Sonnet 5.5 · F3 Sonnet 5.5 → Opus 5.5 (CI roja) → Haiku 5.5 (cierre).
- Relevos (regla 29): F1, Opus → Fable, con cambio de método (bisecar módulos en vez de tocar el empaquetador).
- `/compact`: 2 pedidos por mí (cierres de F1 y F2). El dueño corrió al menos 4; el conteo exacto no lo tengo.

## Dependencias (publicación, con más de 14 días)

- tesseract.js 7.0.0 (2025-12-15, Apache-2.0); @tesseract.js-data/spa y eng 1.0.0 (2023-09-04, MIT); zxing-wasm 3.1.6 (2026-10-19, MIT). No entró la 3.1.7 (2026-11-15).

## Commits y servidores

- 28 commits: lector F1 (10), catálogo y súper F2 (4), pruebas, docs y CI F3 (14; incluye 3 del workflow temporal de TBT, borrado en `659f3e5`). Añadidos por ruta, nunca `git add -A`.
- TBT en el runner (16 rutas, mediana de 10, main contra rama): ninguna ruta peor que main salvo ruido; `/recetas` 147 vs 148 en la segunda pasada.
- `lsof -nP -iTCP -sTCP:LISTEN`: 0 procesos de este sprint con cwd en el repo. Cerré un Playwright de hace 7 días con cwd en el repo. Sin cerrar, de otras apps: VS Code y el host de Claude Code (su cwd es el repo; no es un servidor mío).

## Recomendación

- Mergear. En el ensayo general, probar el lector con fotos reales y el escáner en un teléfono real.

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
