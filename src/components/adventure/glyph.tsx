/**
 * Los seis símbolos de la aventura, tal como los eligió el dueño en `juego.html`. Cada ficha lleva
 * su símbolo Y su palabra: ninguna comunica solo con color o solo con dibujo.
 */
export type GlyphName =
  "moon" | "ball" | "drop" | "sun" | "spoon" | "new" | "lock" | "check";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;

function Paths({ name }: { name: GlyphName }) {
  switch (name) {
    case "moon":
      return (
        <path
          d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
          strokeLinejoin="round"
          {...S}
        />
      );
    case "ball":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" {...S} />
          <path
            d="M3.5 12h17M12 3.5c3 2.5 3 14.5 0 17M12 3.5c-3 2.5-3 14.5 0 17"
            {...S}
            strokeWidth={1.6}
          />
        </>
      );
    case "drop":
      return (
        <path
          d="M12 3c3.5 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.5-6.5 6-11z"
          strokeLinejoin="round"
          {...S}
        />
      );
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4.2" {...S} />
          <path
            d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
    case "spoon":
      return (
        <>
          <path
            d="M3.5 12h17a8.5 8 0 0 1-17 0z"
            strokeLinejoin="round"
            {...S}
          />
          <path
            d="M13.5 12l4-9"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <path
            d="M8 7.5c0-1.5 1-1.5 1-3M11 8c0-1.2.8-1.2.8-2.4"
            {...S}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      );
    case "new":
      return (
        <>
          <path
            d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 16.5l-1.8-5.2L5 9.5l5.2-1.8z"
            strokeLinejoin="round"
            {...S}
          />
          <path
            d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"
            fill="currentColor"
          />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" {...S} />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...S} />
        </>
      );
    case "check":
      return (
        <path
          d="M5.5 12.5l4.2 4.2 8.8-9.4"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}

export function Glyph({
  name,
  className,
}: {
  name: GlyphName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={className ?? "size-7"}
    >
      <Paths name={name} />
    </svg>
  );
}
