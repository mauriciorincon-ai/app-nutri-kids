/**
 * Pastilla "Hoy" — marca el día/elemento vigente. Dueño único de este estilo
 * (antes duplicado literal en /historial y /suplementos). Tokens del design
 * system: fondo primario, texto sobre-primario, mayúsculas con tracking.
 */
export function TodayBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
      {children}
    </span>
  );
}
