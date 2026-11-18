"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Monta a sus hijos cuando llegan a la zona de lectura (como las tarjetas del brochure): el QR y su
 * librería no se piden hasta que la etiqueta se ve, y el hueco ya tiene su tamaño (sin saltos).
 */
export function WhenInView({
  children,
  placeholder,
}: {
  children: ReactNode;
  placeholder: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px 15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return <div ref={ref}>{seen ? children : placeholder}</div>;
}
