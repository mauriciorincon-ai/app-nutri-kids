---
description: Planea el trabajo del sprint activo leyendo la orden de construcción emitida por la casa planeadora.
---

# /plan-sprint

Prepara el plan de ejecución del sprint a partir de la **orden de construcción** que el usuario
indique (o la más reciente en `portafolio/<slug>/ordenes/` de la planeadora,
`C:\Code\hr01-develop-ai-apps\`, agregada como directorio adicional de solo lectura).

## Pasos

1. Lee la orden de construcción completa.
2. Lee sus referencias: `portafolio/<slug>/sprints/SPRINT_NNN.md` (con `status: open`), el brief,
   y el prototipo READ-ONLY si la orden lo referencia.
3. Lee los estándares del pipeline (`estandares/estandares.md` de la planeadora) — los 6+1 gates.
4. Analiza el estado actual del código de **este** repo.
5. Propón un plan de ejecución por fases:
   - **Fase 0 — Setup:** deps, config, scaffolding si falta. **Humo de credenciales (kit v1.7.4):**
     si el sprint usa un proveedor externo cuya key ya esté configurada, corre su comando de humo
     (columna "Humo" de la orden) ANTES de la fase 1; si no está, decláralo — la validación real
     queda para el gate.
   - **Fase 1 — Motor/núcleo:** lógica pura con tests (y `lib/ia/` si el sprint toca LLM — skill `ia-embebida`).
   - **Fase 2 — UI:** integración visual (paleta/microcopy del prototipo, construido desde cero).
   - **Fase 3 — Integración + e2e:** tests end-to-end + axe.
   - **Fase 4 — Calidad:** gates de los 6+1 estándares (`/deploy-check`).
6. Para cada fase: archivos a crear/modificar, tests a escribir, criterio observable de "fase completa".
   **Sección obligatoria del plan (kit v1.7.3): "Riesgos de integración con lo existente"** — lee
   EL CÓDIGO de las features que la nueva toca (e2e que asumen el layout actual, claves de storage
   nuevas, motores compartidos) y enumera lo que encuentres; el riesgo nº 1 suele no estar en la orden.
7. **El plan aprobado NO arranca la construcción** (gate de arranque, kit v1.6.2). **Detente**;
   emite el **bloque de arranque** — recomendación de **modelo y esfuerzo** para el sprint (por
   fase si difiere) + recordatorio de que el usuario los fija con `/model` + espacio para sus
   ajustes — y espera su palabra explícita **«construye»**. Prohibido crear o editar archivos antes.

## Output esperado

Un plan en markdown con la estructura de arriba. Recuerda: **nunca escribes en la planeadora**; si
detectas que el plan del sprint necesita cambio, anótalo como `## Desviación del plan` en tu
bitácora y decláralo en el plan propuesto.
