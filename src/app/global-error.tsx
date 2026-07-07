"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
          <h1>Algo salió mal</h1>
          <p>
            La app tuvo un problema inesperado. Tus datos siguen guardados en tu
            teléfono.
          </p>
          <button type="button" onClick={() => reset()}>
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
