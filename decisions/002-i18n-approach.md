# ADR 002 — i18n: diccionarios TypeScript propios, sin librería

- **Estado:** aceptada · Sprint 001 · 2026-07-07
- **Contexto:** app bilingüe ES/EN desde el día 1, con paridad exigida por tests. Opciones:
  next-intl (rutas /es /en), react-i18next, o diccionarios propios.
- **Decisión:** diccionarios tipados `src/i18n/{es,en}.ts` + provider propio (`src/i18n/index.tsx`)
  con `useI18n()` → `{ t, l, locale, setLocale, fmt }`. Sin dependencia externa. El locale vive en
  prefs (localStorage) y actualiza `<html lang>`; NO hay rutas por idioma.
- **Razones:**
  1. **Paridad estructural en compile-time:** `en` se tipa con `Dictionary` (derivado de `es`) —
     una clave faltante o sobrante rompe `tsc`. El test de paridad añade el chequeo runtime
     (strings vacíos y {placeholders} iguales).
  2. Dos idiomas y una familia como usuarios: el costo de next-intl (middleware, rutas
     duplicadas, config) no compra nada aquí.
  3. **LCP estático en ES:** el servidor prerenderiza siempre ES (idioma primario de la mamá);
     si la preferencia es EN el texto cambia al hidratar. Con rutas /en se ganaría prerender EN,
     irrelevante para el caso de uso.
- **Contenido de datos:** la dieta trae sus propios campos `{es,en}` (schema zod los exige);
  `l()` selecciona el idioma activo. UI y datos comparten un solo switch.
- **Límite conocido:** si algún día hay >2 idiomas o SEO multilingüe (no aplica: app personal),
  se reevalúa con next-intl.
