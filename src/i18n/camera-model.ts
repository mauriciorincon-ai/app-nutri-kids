import type { Locale } from "./index";

/**
 * Los textos de «Borrar el modelo» de Ajustes (S12 · ADR-018), aparte de `camera.ts` para que
 * Ajustes no cargue los de la cámara. Redactados en cada idioma; paridad por test.
 */
const es = {
  title: "El modelo de la cámara",
  body: "Ocupa unos {mb} MB en este teléfono. Borrarlo no toca tu plan ni tu registro; para volver a usar la cámara se descarga de nuevo.",
  none: "No hay ningún modelo guardado en este teléfono.",
  button: "Borrar el modelo",
  done: "Modelo borrado.",
  checking: "Mirando qué hay guardado…",
};

const en: typeof es = {
  title: "The camera model",
  body: "It takes about {mb} MB on this phone. Deleting it doesn't touch your plan or your log; to use the camera again it downloads again.",
  none: "There is no model saved on this phone.",
  button: "Delete the model",
  done: "Model deleted.",
  checking: "Checking what is saved…",
};

export type CameraModelText = typeof es;
export const cameraModelText: Record<Locale, CameraModelText> = { es, en };
