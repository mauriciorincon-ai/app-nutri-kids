# ADR 007 — Registro del día: local-only + minimización (jamás red, repo ni grounding)

- **Estado:** aceptada · Sprint 003 · 2026-07-20
- **Contexto:** el S3 añade el **registro del día** — la hora real a la que se marcó cada comida y
  una **nota corta** (chips rechazó/dolor/antojo/otro + texto libre breve) por comida. Esto son
  **datos de salud de un menor** (Ley 1581/2012: minimización, alta privacidad por defecto,
  propósito limitado) — más sensibles que las marcas del checklist del S1, porque la nota describe
  reacciones ("le dolió", "lo rechazó") en texto libre. La app ya tiene un canal que sale del
  dispositivo: el chat (Camino B) envía la dieta anonimizada a un proveedor de IA. La pregunta de
  diseño: ¿dónde vive el registro y qué NUNCA puede tocar?
- **Decisión (cuatro reglas):**
  1. **Local-only, ratifica ADR-001.** El registro vive SOLO en el dispositivo, en
     `localStorage` bajo clave versionada (`nutrikids.daylog.v2`), detrás del wrapper
     `src/lib/diet/day-log.ts`. **Cero backend** — el S3 RATIFICA el "sin BD" (Supabase seguía sin
     entrar; su decisión de privacidad de menor la abre un F0 de fase 2, no este sprint).
  2. **Minimización dura — el registro JAMÁS entra al grounding del chat.** El grounding
     (`src/lib/ia/grounding.ts`) es puro sobre `(diet, locale, date)` y no importa `day-log`: por
     **construcción** no tiene ruta al registro. El request a `/api/chat` lleva exactamente
     `{messages, diet, locale}`. Fijado por **test negativo doble**: unit (una nota/hora centinela
     nunca aparece en `buildGroundedSystem`) + e2e (el body del POST no contiene el centinela y sus
     claves son exactamente esas tres). La nota "le dolió" del niño no puede filtrarse a un tercero.
  3. **Cero contenido en logs.** Los eventos de uso (`src/lib/diet/day-events.ts`) son
     **solo-metadatos**: `registro_marcado` lleva la categoría (`meal`/`supplement`/`water`), nunca
     el alimento concreto; `nota_agregada` lleva `chipCount` + `hasText`, **jamás** los chips ni el
     texto; `recordatorio_visto` no lleva nada. Consistente con ADR-006.
  4. **"Borrar datos" cubre el registro.** `clearAllData` borra la dieta + el day-log (v2 y
     cualquier v1 remanente). El copy de Ajustes lo nombra explícitamente ("marcas, horas y notas").
- **Migración versionada.** El estado del S1/S2 (`nutrikids.daylog.v1`, `Record<fecha, string[]>`)
  se migra al primer read a v2: cada marca entra con `at: null` (hora desconocida — honesto, no se
  inventa), se escribe la v2 y se elimina la v1 (una sola fuente de verdad). Con test desde el
  estado real de un usuario S1/S2 (unit + e2e). v1/v2 corrupto ⇒ registro fresco (fail-safe,
  consistente con la dieta).
- **Recordatorio = información, no dato nuevo.** Los recordatorios ("qué toca ahora / sigue") son
  **100% deterministas** desde `logic.ts` (franja del menú + suplementos del día + hidratación) —
  no persisten nada, no son un canal de salida. Sin push ni permisos del sistema: el recordatorio
  es la información correcta visible en el momento correcto.
- **Razones:** para datos de salud de un menor, el registro local-only + la exclusión estructural
  del grounding es la minimización más fuerte — elimina toda una clase de riesgo (una nota íntima
  viajando a un LLM de terceros). Que la exclusión sea **por construcción** (el grounding ni recibe
  el registro) y no por una comprobación en runtime la hace robusta ante cambios futuros; el test
  negativo la fija como contrato.
- **Consecuencias / deuda:** el registro no se comparte entre cuidadores ni se respalda en la nube
  (decisión de producto, no bug) — el estado compartido multi-cuidador es **fase 2** y exige su
  propio análisis local-first vs nube para datos de menor (contradice ADR-001 sin él). Si esa fase
  llega, la clave versionada permite migrar leyendo `*.v2`. Relacionado:
  [[001-local-storage]] · [[006-chat-privacy]].
