---
sprint: 008
app: nutri-kids
hito: H-2
opened: 2026-11-16
closed: 2026-11-16
branch: sprint-008/avisos-que-llegan
pr: PR_NUM
---

# S8 · Avisos que llegan

**Objetivo/resultado:** la app avisa a la hora del plan (suplementos, comidas y meriendas, agua) con la app cerrada, y una nota de quien cuida despierta a los demás teléfonos; el aviso se arma EN el teléfono y el servidor solo guarda horas sin etiqueta y manda toques vacíos. **Estado:** construido y auditado (ADR-012, G-Plan «1a 2a»); sin dependencias nuevas. QStash, Redis y las llaves VAPID reales se conectan al cierre del H-2 (G-Plan 1a), no es desviación.
**Tiempo** (`node scripts/horas-sprint.mjs`, `origin/main..HEAD`): 18 commits · 1 sesión · **3,0 h activas** (span 2,5 h) · F1 0,7 h (4) · F2 0,7 h (2) · F3 1,7 h (12). **Diferencia vs 3,5 h: −0,5 h (−14 %).** F3 pasó 31 % de su 1,3 h (la auditoría pagó 14 hallazgos); ninguna fase pasó el 50 %.
**Pruebas** (leídas del resultado): unit 51 archivos / 932 de 932 (97,66 % líneas; `src/lib/push` 96,56 %, su servidor 100 %; umbral 90) · e2e 216 verdes + 2 omitidas a propósito = 218 con `CI=1` contra `next start` y el doble del almacén · tsc, eslint y `cero-enlaces` limpios · gitleaks en cada commit · Lighthouse lo corre la CI.
**Entregables:** `src/lib/push/` (horas del plan, VAPID ES256 con WebCrypto, JWT HS256 de QStash, registro Upstash + doble) · `/api/push/*` (subscribe, update, skip, unsubscribe, family, tick, health) · trabajador `scripts/sw-push.js` (arma el aviso con la copia local; abre la nota de la familia con las llaves no exportables) · Ajustes → «Avisos en este teléfono» · Hoy → «Avisar a la familia» · ADR-012 (revisa 003 y 007) · e2e con service worker real y toque entregado por CDP · manual, guía (bloque M), BLUEPRINT, brochure (23) y export.
**Auditoría** (Sonnet 5.5 · high · una pasada · solo lectura; cotejó cada frase del § 1 con ruta:línea y revisó la red como atacante; 0 críticos, 0 altos, 5 medios, 14 bajos; todo pagado):

- Alcance: las 6 frases y «1a 2a» completas, con ruta:línea; M5 faltaba axe en estados nuevos (sin soporte, bloqueado, iPhone, no disponible, sin red, versión nueva, error del servidor, nota vacía, guardada sin red) `pagado · bdac3f8`.
- Calidad: M1 a los 400 días el servidor olvidaba al teléfono (renueva cada 30 d; lo vencido libera el tope) `pagado · 7946952, 9be6f03` · M2 activar con una versión nueva esperando → pide actualizar antes del permiso `pagado · 9be6f03` · M4 el silencioso «ya marcado» se tragaba la nota de la familia `pagado · 9be6f03` · B1 «Borrar datos» apagaba avisos aunque fallara la familia `pagado · 9be6f03` · B2 sin tiempo límite al enviar `pagado · 7946952` · B3 quien salió de la familia seguía recibiendo toques (huella del token vigente) `pagado · 7946952` · B4 dos registros por dirección `pagado · 7946952` · B5 direcciones rechazadas nunca se purgaban (3 en 2 días) `pagado · 7946952` · B7 pruebas que faltaban (sin llaves de firma → 401, dirección fuera de lista, `/\`) `pagado · 7946952, 9be6f03`. Cada uno con su prueba.
- Seguridad y privacidad: sin contenido en cuerpos ni en el toque, VAPID, firma del reloj, tiempo constante, SSRF, logs y Sentry: limpio · M3 el «saltar» envía fecha y minuto: ahora lo dicen ADR §9, copy es/en, manual, brochure `pagado · ba3b44e, e52da4b` · B6 hash de IP con sal del servidor `pagado · 7946952` · B8 `clickUrl` rechaza `/\` `pagado · 9be6f03`.
- Frases caducadas: B9 «la única ruta de servidor» `pagado · ba3b44e` · B10 comentario de `no-cloud-ai` `pagado · ba3b44e` · B11 BLUEPRINT «solo si la familia comparte» `pagado · e52da4b` · B12 ADR-007 `pagado · ba3b44e` · B13 «dice solo Nutrikids» → mensaje genérico `pagado · ba3b44e, e52da4b` · B14 `.env.example` sin las variables `pagado · ba3b44e`. Evidencia (910→932, 202→218, 97,66 %) `pagado · c539116`. Veredicto: listo para cierre.
  **Bug real hallado por la e2e:** `runRefresh` revertía un interruptor tocado durante una puesta al día y «dejar de recibir» podía resucitar el estado `pagado · f529e17` (2 pruebas).
  **Defaults técnicos:** suplementos a la hora de la primera comida (el plan no trae hora) · agua repartida en la rejilla de 5 min · el disparador mira 10 min, el trabajador 15 · «enviado» con `SET NX` antes de enviar · renovar cada 30 d · purga a 3 rechazos 400/401/403 en 2 d · sal de IP = la llave VAPID privada · 3 intentos de entrega en la e2e.
  **Riesgos abiertos:** (1) `next build` se detiene ~1 de cada 3 por el aviso de seguridad de Next 16.4.4; se reintenta y pasa; **actualizar Next lo decide el dueño**, no se corrió. (2) Chromium headless a veces pierde una notificación que el trabajador sí armó; mitigado con 3 intentos; ~1 de 26 corridas falló; la CI reintenta 2. (3) Redis, QStash y VAPID reales no se ejercitaron (CI y e2e usan el doble y llaves de prueba).
  **Desviaciones:** ninguna. **Deuda:** ninguna. **No completado:** nada del alcance. **Capturas:** Ajustes leído como imagen en móvil y escritorio (el sistema es solo claro; «dark» es guarda); FORMA y TEXTO nuevos van «no vistos» al ensayo general.
  **Modelo por fase y desvío:** F1 Opus 5.5 · F2 y F3 Sonnet 5.5, como se requería; cierre con Sonnet (se pedía Haiku), sin desvío de calidad. **Relevos:** 0. **/compact pedidos:** 2 (F1→F2, F2→F3).
  **Recomendación:** al cierre del H-2 el dueño pega las 5 variables en Vercel y crea el horario de QStash (cada 5 min, POST `/api/push/tick`), y prueba en un teléfono real (Android e iPhone instalado). **Esfuerzo-beneficio:** alto: el recordatorio deja de depender de abrir la app, sin romper la regla 6.
  **Servidores:** `lsof` LISTEN en este repo: 0 (excluidos el test-server de Playwright de VS Code y el proceso de Claude Code, que no son de la app; el 3600 de esta sesión, cerrado).
  **Para mergear: squash y borrar la rama; después `/cierre-sprint nutri-kids`.**
