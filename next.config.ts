import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El badge dev de Next flota sobre la nav inferior móvil e intercepta taps
  // (rompía los e2e móviles); el overlay de errores sigue activo.
  devIndicators: false,

  // El brochure vivo se sirve en /conoce con los MISMOS bytes de docs/BROCHURE.html
  // (lo copia `scripts/sync-brochure.mjs` en el prebuild; un test verifica la igualdad).
  // No es una pantalla del producto: no entra al bottom-nav ni al conteo de pantallas.
  async rewrites() {
    return [{ source: "/conoce", destination: "/conoce.html" }];
  },
};

export default nextConfig;
