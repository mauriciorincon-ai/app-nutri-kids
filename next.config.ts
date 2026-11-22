import type { NextConfig } from "next";

/**
 * Lo que el worker de la cámara puede alcanzar con la red (S12 · ADR-018): la app, el Hub de modelos
 * y su CDN. Va en la respuesta de `/ia/vision-worker.js`, que es la que el navegador aplica al worker:
 * incluso un fallo en su guardia no podría sacar una foto a otro sitio.
 */
export const VISION_WORKER_CSP =
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co";

/**
 * Red del worker del lector de etiquetas (S13 · ADR-019): solo la propia app. El núcleo y los
 * idiomas se sirven desde `/ocr/`; la foto y el texto leído no tienen adónde salir.
 */
export const OCR_WORKER_CSP = "connect-src 'self' blob: data:";

const nextConfig: NextConfig = {
  // El badge dev de Next flota sobre la nav inferior móvil e intercepta taps
  // (rompía los e2e móviles); el overlay de errores sigue activo.
  devIndicators: false,

  // En el bundle del navegador, `pino` es el logger mínimo de la app (misma forma, sin el
  // paquete): cada pantalla pesa unos KB menos (S12). El servidor sigue con pino.
  turbopack: {
    resolveAlias: {
      pino: { browser: "./src/lib/log-browser.ts" },
    },
  },

  // El brochure vivo se sirve en /conoce con los MISMOS bytes de docs/BROCHURE.html
  // (lo copia `scripts/sync-brochure.mjs` en el prebuild; un test verifica la igualdad).
  // No es una pantalla del producto: no entra al bottom-nav ni al conteo de pantallas.
  async headers() {
    return [
      {
        source: "/ia/vision-worker.js",
        headers: [{ key: "Content-Security-Policy", value: VISION_WORKER_CSP }],
      },
      {
        source: "/ocr/worker.min.js",
        headers: [{ key: "Content-Security-Policy", value: OCR_WORKER_CSP }],
      },
    ];
  },

  async rewrites() {
    return [{ source: "/conoce", destination: "/conoce.html" }];
  },
};

export default nextConfig;
