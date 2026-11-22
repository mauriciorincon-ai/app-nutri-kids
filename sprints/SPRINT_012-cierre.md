---
sprint: 012
app: nutri-kids
hito: H-2
opened: 2026-11-20
closed: 2026-11-22
branch: sprint-012/camara
pr: 21
---

# Sprint 012 · La cámara

- **Nombre · objetivo:** La cámara · foto → receta y mirar el plato; el modelo ve, el código cocina (ADR-018).
- **Estado:** entregado · listo para merge (CI verde en 2c30093).
- **Tiempo:** estimado 6,5 h · real 4,2 h · diferencia −2,3 h (−35 %). Salida de `node scripts/horas-sprint.mjs`:

```
Commits 21 · Sesiones 3 · Horas activas 4,2 h · Span 2026-11-20 23:09 → 2026-11-22 15:10
| F1 | 7 | 1,5 h | | F2 | 4 | 0,5 h | | F3 | 10 | 2,3 h |
```

- **Entregables:** /camara (descarga, foto, lo visto ✓/✗, motor) · /camara/cocina (despensa → 37 recetas + 6 plantillas) · mirar el plato (semáforo: símbolo, texto y color) · Ajustes: borrar el modelo · enlace en Hoy.
- **No completado:** prueba en teléfono (desviación) · etiquetas y supermercado (S13).
- **Desviaciones:** (1) prueba en teléfono sin hacer: decisión del dueño (2026-11-22), va al ensayo general del H-2. (2) Lighthouse rojo en el primer push: TBT /recetas 646, /lonchera 490, /viaje 329 ms (presupuesto 300); causa 408d46e (`avoidedByNotes` volvía a trocear ~30 textos por ingrediente); medida 2c30093 (textos precalculados), CI verde.
- **Decisiones (defaults míos):** SmolVLM-256M q4f16 (160,4 MB) desde /ia/, sin CDN · WebGPU o WASM de un hilo · foto en memoria, nunca guardada ni subida · red del worker cerrada dos veces, CSP `connect-src` solo en /ia/vision-worker.js · despensa local, sin registro nuevo.
- **Dependencias:** @huggingface/transformers 4.3.2 (publicada 2026-10-27, 26 días, Apache-2.0) · onnxruntime-web 1.31.0-dev.20260914-8d85527a0, transitiva (pnpm-lock.yaml:4143), build dev de 2026-09-14 (69 días): ver B4.
- **Medidas Mac:** 256M WebGPU 189 MB, carga 7,1 s, 0,6 s/foto; WASM 9,8 s/foto · 500M (solo medición) 330,7 MB, 0,8–2,1 s/receta, 0/5 utilizables · 10 fotos bajo CSP: 0 fallos, 0 peticiones externas antes del toque · /camara 438,5 KB, /camara/cocina 428,4 KB (≤ 440).
- **Medidas CI y pruebas:** Hoy TBT 231 ms (mediana de 10; main 286,5 en la misma corrida) · unit 79 archivos, 1425/1425, 97,27 % · e2e 360 (358 + 2 omitidas, 0 fallidas) · 258 chunks, 0 rastros · demo-rojo falla con mutación en src/lib/camera/client.ts y vuelve a verde.
- **Auditoría** (Sonnet, solo lectura, 4 casillas):
  - Alcance: completo salvo la prueba en teléfono.
  - Calidad: S1, S2, M3, B3, B6, B8 → pagado · d7cdf3c · C1–C4, M1, M5, B1, B2 → pagado · 408d46e · TBT de CI → pagado · 2c30093.
  - Seguridad y privacidad: B7 → pagado (demo-rojo, sin commit) · B5 → sin cambio (la demo ya valida con Zod) · B4 → abierto, decisión del dueño.
  - Frases caducadas: M4 y textos de evidencia → pagado · 67e9636.
- **Deuda (solo lo imposible):** B4 · pnpm-lock.yaml:4143 · build dev de onnxruntime-web: decisión del dueño (aceptar hasta G-Release o esperar la estable) · presupuesto TBT de Hoy · perf-budget.json:7 fija 300; Hoy 231 · decisión del dueño (S11): ¿250 para Hoy? · cita OMS 2019 · docs/MANUAL-DE-USO.md:362 · decisión del dueño.
- **Modelo por fase:** F1 Opus 5.5 · high (requerido), activo no registrado · F2 Sonnet → Opus (relevo: dos intentos colgados con el worker en blob; método: worker en URL real) · F3 Sonnet → Opus (relevo: CI roja; método: medir main y la rama en la misma sesión) · cierre Haiku 5.5.
- **Compactaciones:** 2 (F1→F2, F2→F3).
- **Servidores al STOP:** `lsof` LISTEN en este repo: 0 míos (3600 cerrado). Reportado, no cerrado: node PID 70525, test-server de Playwright lanzado desde la extensión de VS Code el 16-nov.
- **Aprendizajes:** un gate de rendimiento se decide en el runner, no en el Mac; una capa de cotejo en camino caliente se mide antes de llegar a la CI.
- **Recomendación:** merge tras la decisión del dueño sobre B4; la prueba en teléfono, en el ensayo general. **Esfuerzo-beneficio:** alto.
- PRs abiertos al pedir el merge: #21.

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
