/**
 * Quién usa la cámara en una familia (S12 · ADR-018). No hay un tipo nuevo de registro: la despensa
 * es de este teléfono y se pide con la misma clase de escritura que la lonchera (la cocina de la
 * casa: madre, padre y cuidador); mirar el plato es anotar lo que se come, con la regla de «lo que
 * come» (el colegio solo en sus comidas). La misma `may()` que usa la sincronía decide ambas.
 */
import type { Write } from "@/lib/family/roster";

/** Guardar lo confirmado en la despensa y ver qué se puede cocinar. */
export const pantryWrite = (): Write => ({ k: "lunch" });

/** Mirar el plato de una comida: se anota lo que come, así que cuenta como `food` de esa comida. */
export const plateWrite = (mealId: string): Write => ({
  k: "food",
  meal: mealId,
});
