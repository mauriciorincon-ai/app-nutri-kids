---
sprint: 007
app: nutri-kids
hito: H-2
opened: 2026-11-15
closed: 2026-11-16
branch: sprint-007/familia-cifrada
pr: (se llena al abrirlo)
---

# S7 · La familia, cifrada

**Objetivo/resultado:** quienes cuidan al peque comparten plan, día (marcas, horas, notas y quién) y perfil entre sus teléfonos; todo viaja cifrado de punta a punta y el servidor (Upstash Free tras una ruta mínima) solo guarda bytes ilegibles. **Estado:** construido y auditado (ADR-011, decisiones del dueño «1 a 2 a»); sin red hasta que se elige crear o entrar.
**Tiempo** (`node scripts/horas-sprint.mjs`, `origin/main..HEAD`): 11 commits · 2 sesiones · **2,5 h activas** (span 10,8 h) · F1 0,5 h (4) · F2 0,7 h (3) · F3 1,3 h (4). **Diferencia vs 6,0 h: −3,5 h (−58 %).** Ninguna fase pasó el 50 % de su estimado (2,2 · 2,0 · 1,8).
**Pruebas** (todas leídas del resultado): unit 41 archivos / 785 de 785 (97,6 % líneas; `src/lib/family` 97,23 %, umbral 90) · e2e 180 de 180 con `CI=1` contra `next start` y el doble en memoria · familia.spec 14 de 14 tres veces seguidas · tsc, eslint y `cero-enlaces` limpios · Lighthouse 7 de 7 URL (+`/ajustes`) dentro de `perf-budget.json`.
**Entregables:** `src/lib/family/` (frase y código Crockford, PBKDF2 600 k + HKDF, AES-GCM con IV nuevo y relleno a 256 B, mezcla LWW con lápidas, sincronía, llavero IndexedDB no exportable) · ruta `/api/family/*` + doble `FAMILY_STORE=memory` · registro del día v3 y perfil con «quién» (migración) · Ajustes → Compartir con la familia · «Por X» en Hoy, Días anteriores y Perfil · ADR-011 (revisa 001, 007, 009) · e2e de dos teléfonos con centinela sobre cada petición · manual, guía (bloque L), BLUEPRINT, brochure (22) y export.
**Auditoría** (Sonnet 5.5 · high · una pasada · solo lectura · cotejó cada frase del Resultado esperado y revisó el cifrado como atacante; todo pagado):

- Alcance: frase «Borrar mis datos» no sacaba lo compartido → casilla opcional que también borra la copia de internet `pagado · 9fbbcc2` · las notas del día no decían quién → `by` + «Por X» `pagado · 9fbbcc2` · el consentimiento omitía la frase perdida y cómo salir `pagado · 9fbbcc2`.
- Calidad: tope por letras en vez de bytes (un plan con tildes se colaba) → `sealedSize` en bytes `pagado · 9fbbcc2` · día que no cabe sin aviso → contado y mostrado `pagado · 9fbbcc2` · `unreadable` se pisaba `pagado · 9fbbcc2` · `constructor`/`toString` como operación `pagado · 9fbbcc2` · fallo del llavero tumbaba crear/cambiar frase → avisa y sigue `pagado · 9fbbcc2` · filas hechas bajo AA `pagado · 1959259` · red al abrir Ajustes sin elegir `pagado · 1959259` · la e2e aceptaba un almacén real → guarda en `global-setup` `pagado · 9fbbcc2`. Cada uno con su prueba.
- Seguridad y privacidad: IV nuevo por registro, clave no exportable, token sellado con AAD, `timingSafeEqual`, texto en claro/logs/Sentry: sin hallazgo abierto · «el servidor no tiene Sentry» era falso → ADR-011 dice que sí y que el depurador quita cabeceras, cuerpo, cookies `pagado · 9fbbcc2` · oráculo de `join`, metadatos visibles, costo y tope de abuso declarados `pagado · 9fbbcc2` · «PBKDF2 bloquea el hilo» **descartado con evidencia**: 39 ms medidos, peor hueco 12 ms.
- Frases caducadas: «anotado por ti» → «por quien cuida» `pagado · 24e309e, 9fbbcc2` · ADR-009 «nunca sale» y ADR-001 Supabase, comentarios de `storage.ts` e `instrumentation-client.ts`, encabezado/filtro/rama de la guía, «mientras no elijas» del manual y del brochure `pagado · 9fbbcc2`. Veredicto: listo para cierre.
  **Defaults técnicos:** tope 64 KB por registro y 256 KB el plan · rotar en dos pasos (borrar en servidor, re-subir) · TTL 400 días · relleno a 256 B · scripts Lua probados en wasmoon contra un Redis simulado · fake-indexeddb 6.2.6 (6.2.8 no cumplía 14 días) · el aviso de plan distinto solo en el teléfono que lo detecta · `FAMILY_STATE_ITEM` (gitleaks daba falso positivo con `_KEY`) · `leave()` espera la sincronía en curso · salud del servicio solo al elegir crear/entrar · filas hechas en `muted-foreground`, no `opacity-55` · tema oscuro solo como guarda (`emulateMedia`; el sistema es claro) · Lighthouse suma `/ajustes`.
  **Desviaciones:** (1) `CLAUDE.md` aún no lista `src/lib/family/`, `src/lib/device.ts` ni `/api/family`: declarado, no editado. (2) **Upstash real no se ejercitó** (la CI y las e2e usan el doble); el preview de F1 con `"store":"real"` no lo confirmó el dueño. **Deuda:** ninguna. **No completado:** nada del alcance.
  **Capturas:** FORMA y TEXTO nuevos van «no vistas» al ensayo general del hito; los estados (crear, entrar, consentimiento, sin red, sacar, salir, borrar) están congelados en e2e y pasan axe en los dos temas.
  **Modelo por fase y desvío:** F1 Opus 5.5 · F2 Sonnet 5.5 · F3 Sonnet 5.5, como se requería; cierre con Sonnet (se pedía Haiku), sin desvío de calidad. **Relevos:** 0. **/compact pedidos:** 2 (F1→F2, F2→F3).
  **Recomendación:** antes del ensayo general, el dueño abre `/api/family/health` en el preview y confirma `"store":"real"`, y prueba crear/entrar con dos teléfonos reales. **Esfuerzo-beneficio:** alto: cierra la mayor fuga posible (red de datos de salud) sin dependencias nuevas.
  **Servidores:** `lsof` LISTEN en este repo: 0 (excluido el test-server de Playwright de VS Code; el 3600 de esta sesión, cerrado).
  **Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.**
