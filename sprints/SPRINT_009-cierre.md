---
sprint: 009
app: nutri-kids
hito: H-2
opened: 2026-11-16
closed: 2026-11-16
branch: sprint-009/coordinacion
pr: pendiente
---

# S9 · Coordinación

- **Objetivo:** varias personas cuidan al niño sin que nadie cambie el plan o el día a escondidas; plan B, días especiales y unir dos planes.
- **Resultado:** roles firmados por persona (ADR-013); plan B y días especiales desde el plan guardado (ADR-014); unión de dos planes con el origen de cada línea.
- **Estado:** listo para PR. Sin dependencias nuevas.
- **Tiempo:** estimado 5,0 h · real 4,0 h (`node scripts/horas-sprint.mjs`) · **diferencia −1,0 h (−20 %)**.
- **Fases:** F1 roles 0,5 h (5 commits) · F2 plan B y unión 1,4 h (4) · F3 e2e, docs, auditoría 2,1 h (8). Ninguna pasó el 50 %.
- **/compact pedidos:** 2 (F1→F2, F2→F3).
- **Pruebas (leídas):** unitarias 1117 de 1117 (57 archivos) · e2e `CI=1` 244 verdes + 2 omitidas a propósito · cobertura de líneas 96,91 % (`src/lib/family` 97,02 %) · tsc, eslint y `cero-enlaces` limpios.
- **Capturas:** Escenarios, Varias dietas, Perfil y Hoy con plan B, leídas como imagen, claro y oscuro, móvil.

**Auditoría** (auditor en solo lectura, una pasada; todo pagado salvo lo indicado):

- **Alcance:** frases del § 1 cotejadas con ruta:línea · `pagado · 48deb7d…1d1984e`.
- **Calidad:** S-1/S-2 carreras del roster → cola de turnos en `controller.ts` · `pagado · b9024c8`, pruebas que caen sin la cola · `pagado · a21105f` · S-3 hora futura que gana para siempre → cota de 5 min en `trust.ts` · `pagado · b9024c8`, pruebas · `pagado · a21105f` · Q-1 alergias anotadas sugeridas por el plan B → `pagado · b9024c8` · Q-2 notas de cuidador en el perfil: ya cubierto por la prueba de `family-roles` (sin cambio) · Q-3 unión en orden (B,A) · `pagado · a21105f` · Q-4 almacén negado en `second-plan.ts` · `pagado · b9024c8`, pruebas · `pagado · a21105f` · Q-6 `plan-line` con nombre · `pagado · b9024c8`, prueba · `pagado · a21105f` · Q-7 `role="status"` · `pagado · b9024c8` · Q-8 aviso o marca falsificados con llave propia · `pagado · a21105f` · Q-9 claves crudas en `/unir` → nombres es/en · `pagado · b9024c8`, e2e · `pagado · a21105f` · Q-11 tope del roster también de peso · `pagado · b9024c8`, pruebas · `pagado · a21105f` · Q-12/D-2 conteo de pruebas de ADR-014 · `pagado · 1d1984e`.
- **Seguridad y privacidad:** S-4 huella comparada en persona · `pagado · b9024c8, 1d1984e` · S-5 prueba de longitud 12 · `pagado · a21105f` · S-6 etiqueta de `plan-line` · `pagado · b9024c8`.
- **Frases caducadas:** D-1 cifras del brochure desde las corridas finales · `pagado · 1d1984e, 394d3e8` · D-3 evidencias con la cuenta real · `pagado · 1d1984e` · D-4 sin promesas aplazadas (solo «Aún no…» de estado) · sin cambio.
- **Nuevo, de la revisión de capturas:** plan B «llegamos tarde» repetía el punto («tiras..») · `pagado · 394d3e8`.
- **Abierto:** el rechazo por peso del roster llega como `invalid` (mensaje genérico). **Decisión del dueño:** ¿lo pagamos en este PR (≈ 20 min, motivo nuevo `full` y copy en dos idiomas) o lo llevamos al ensayo general?

**Desviaciones:** ninguna de alcance. **Deuda:** solo la decisión anterior.
**Defaults técnicos:** hora futura en 5 min · cola de turnos única · tope de 64 KB cifrado por registro · huella comparada en persona · `second-plan` tolera almacén negado.
**Modelo por fase:** F1 Opus 5.5 · F2 y F3 Sonnet 5.5 · cierre Haiku 5.5 (pedido). Sin desvío. **Relevos:** 0.
**Aprendizaje:** la e2e de axe y las capturas encontraron lo que las pruebas unitarias no (lista `dl` inválida, punto doble del plan B).
**Recomendación:** ensayo general del dueño sobre `/escenarios`, `/unir` y roles con dos teléfonos reales.
**Servidores:** `lsof` LISTEN en este repo: 0 (el 3600 cerrado; un `playwright test-server` del editor, no es de la app).

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
