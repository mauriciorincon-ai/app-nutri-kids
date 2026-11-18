"use client";

import { useEffect, useState } from "react";

import { qrModules } from "@/lib/lunchbox/qr";

/**
 * El QR de la etiqueta, dibujado como un solo trazo SVG. La librería se carga con un `import()`
 * dentro de `qrModules`, y este componente solo lo trae la pantalla de la lonchera (`next/dynamic`).
 * Sin red: el texto se codifica en el teléfono.
 */
export default function LunchQr({
  text,
  alt,
  building,
  failed,
}: {
  text: string;
  alt: string;
  building: string;
  failed: string;
}) {
  const [state, setState] = useState<{
    text: string;
    modules: boolean[][] | "error";
  } | null>(null);

  useEffect(() => {
    let live = true;
    qrModules(text).then(
      (modules) => live && setState({ text, modules }),
      () => live && setState({ text, modules: "error" }),
    );
    return () => {
      live = false;
    };
  }, [text]);

  if (!state || state.text !== text)
    return <p className="text-sm text-muted-foreground">{building}</p>;
  if (state.modules === "error") return <p className="text-sm">{failed}</p>;

  const n = state.modules.length;
  const quiet = 4;
  const size = n + quiet * 2;
  let d = "";
  state.modules.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox={`0 0 ${size} ${size}`}
      className="size-44 shrink-0 bg-white"
      shapeRendering="crispEdges"
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
