import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El badge dev de Next flota sobre la nav inferior móvil e intercepta taps
  // (rompía los e2e móviles); el overlay de errores sigue activo.
  devIndicators: false,
};

export default nextConfig;
