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

- **Objetivo:** que varias personas cuiden al niño sin que nadie pueda cambiar el plan o el día a escondidas; plan B, días especiales y unir dos planes.
- **Resultado:** construido y auditado. Roles con permiso firmados por persona (ADR-013), plan B y días especiales desde el plan guardado (ADR-014), unión de dos planes con el origen de cada línea.
- **Estado:** listo para el PR. Sin dependencias nuevas (firma con WebCrypto).
- **Tiempo estimado:** 5,0 h · **tiempo real:** 4,0 h (`node scripts/horas-sprint.mjs`, rango `origin/main..HEAD`):

| Fase                                   | Commits | Horas activas |
| -------------------------------------- | ------: | ------------: |
| F1 roles firmados (ADR-013)            |       5 |         0,5 h |
| F2 plan B, escenarios, unión (ADR-014) |       4 |         1,4 h |
| F3 e2e, docs, auditoría, cierre        |       8 |         2,1 h |

- **Diferencia:** −1,0 h (−20 %). Ninguna fase pasó el 50 % de su estimado.
- **/compact pedidos:** 2 (F1→F2 y F2→F3).
- **Pruebas (leídas del resultado):** unitarias 57 archivos, 1117 de 1117 · e2e `CI=1` 244 verdes + 2 omitidas a propósito = 246 · cobertura de líneas 96,91 % (`src/lib/family` 97,02 %, su servidor 100 %) · tsc y eslint limpios · `cero-enlaces` limpio (homepage = el propio repo).
- **Capturas:** Escenarios, Varias dietas, Perfil y Hoy (con plan B) leídas como imagen, en claro y oscuro, móvil.

**Entregables:** `src/lib/family/` (roster firmado, log encadenado, trust con cota de hora futura, turnos en el controlador) · `src/lib/diet/` (`plan-b.ts`, `scenarios.ts`, `second-plan.ts`, `reconcile.ts`) · `src/app/escenarios`, `src/app/unir`, Hoy con plan B · ADR-013 y ADR-014 · manual, guía, blueprint y brochure (6 tarjetas, 27 funcionalidades).

**Auditoría** (auditor de una pasada en solo lectura, cotejo del § 1 y ataque como rol; todo pagado salvo lo indicado abajo):

- **Alcance:** frases del § 1 contra ruta:línea completas · `pagado · 48deb7d…1d1984e` (los hallazgos de alcance quedaron en las fases).
- **Calidad:** S-1/S-2 carreras de roster (dos cambios seguidos y sincronía lenta contra quitar a alguien) → cola de turnos en `controller.ts` `pagado · b9024c8` + pruebas `pagado · a21105f` (se comprobó que caen sin la cola) · S-3 hora futura gana para siempre → cota de 5 min en `trust.ts` `pagado · b9024c8` + pruebas `pagado · a21105f` (caen sin la cota) · Q-1 alergias e intolerancias anotadas se sugerían en el plan B y los escenarios `pagado · b9024c8` · Q-2 notas de cuidador en el perfil: ya cubierto por la prueba de `family-roles` «cuidador: marca y anota… las notas del perfil no pasan» (sin cambio de código) · Q-3 invariante de unión también en orden (B,A) `pagado · a21105f` · Q-4 almacén negado o cuota llena en `second-plan.ts` `pagado · b9024c8` + pruebas `pagado · a21105f` · Q-6 `plan-line` muestra la línea con su nombre `pagado · b9024c8` + prueba `pagado · a21105f` · Q-7 rechazos anunciados con `role="status"` `pagado · b9024c8` · Q-8 servidor que falsifica aviso o marca con llave propia `pagado · a21105f` (caen sin la verificación) · Q-9 claves crudas en `/unir` → nombres en llano es/en `pagado · b9024c8` + e2e `pagado · a21105f` · Q-11 tope del roster también de peso `pagado · b9024c8` + pruebas `pagado · a21105f` · Q-12 y D-2 conteo de pruebas de ADR-014 `pagado · 1d1984e`.
- **Seguridad y privacidad:** S-4 la huella se compara en persona o por llamada, en copy es/en y manual `pagado · b9024c8, 1d1984e` · S-5 prueba de longitud 12 de la huella `pagado · a21105f` · S-6 etiqueta de `plan-line` `pagado · b9024c8`.
- **Frases caducadas:** D-1 cifras del brochure recalculadas desde las corridas finales (1117, 246, 96,91 %, 14 ADR, 11 pantallas, 9 sprints, peso 86 697 B medido) `pagado · 1d1984e, 394d3e8` · D-3 evidencias con la cuenta real `pagado · 1d1984e` · D-4 búsqueda de promesas aplazadas en docs, guía, brochure y copy: sin coincidencias de promesa (solo «Aún no…» de estado) `pagado · sin cambio`.
- **Hallazgo nuevo de la revisión de capturas:** el plan B «llegamos tarde» repetía el punto del plan («tiras..») `pagado · 394d3e8` + prueba en es y en.
- **Abierto:** el rechazo por peso del roster llega a la pantalla como `invalid` (mensaje genérico), no como «ya no cabe». Lo dejo abierto a propósito: pedir un mensaje propio agrega un motivo `full` y copy nuevo en dos idiomas. **Decisión del dueño:** ¿lo pagamos ya en este PR (≈ 20 min) o lo llevamos al ensayo general?
- **Veredicto:** listo para cierre, salvo esa decisión.

**Desviaciones:** ninguna de alcance. **Deuda:** la del punto anterior, sin otra.
**Decisiones (defaults técnicos):** cota de hora futura de 5 min · cola de turnos única en el controlador · roster y registros con tope de 64 KB cifrados · huella comparada en persona · `second-plan` tolera almacén negado.
**Modelo por fase y desvío:** F1 Opus 5.5 · F2 y F3 Sonnet 5.5 · cierre Haiku 5.5 (pedido). Sin desvío. **Relevos:** 0.
**Aprendizajes:** la e2e de axe y las capturas encontraron lo que las pruebas unitarias no: una lista `dl` sin hijos válidos y el punto doble del plan B.
**Recomendación:** pasar el ensayo general del dueño sobre `/escenarios`, `/unir` y los roles con dos teléfonos reales.
**Esfuerzo-beneficio:** alto; el plan B y los días especiales dan respuesta en segundos y se abren sin señal.
**Servidores:** `lsof` LISTEN en este repo: 0 (el 3600 de esta sesión está cerrado; queda un `playwright test-server` del editor, que no es de la app).

Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.
