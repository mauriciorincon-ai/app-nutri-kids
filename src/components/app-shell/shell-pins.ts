/**
 * Módulos anclados al cascarón (S13 · ADR-019).
 *
 * Toda pantalla precarga las seis de la barra inferior, así que un módulo que usan varias se baja en
 * CADA ruta. Turbopack fusiona los módulos pequeños pantalla por pantalla: si uno queda en dos
 * fusiones distintas, se baja dos veces (las familias de alergias, repartidas entre Hoy y Chat,
 * pasaron a costar +13 KB en todas las rutas al sumar una pantalla que también las usa).
 *
 * Importado desde el cascarón, el módulo pertenece a todas las pantallas y viaja una sola vez. El
 * gate es el presupuesto de script de Lighthouse (`perf-budget.json`): sin el ancla, sale en rojo.
 */
import { roleCan } from "@/components/family/roles";
import { Checkbox } from "@/components/ui/checkbox";
import { expandAvoid } from "@/lib/diet/allergen-families";

/**
 * S14: el `Checkbox` de Radix y `family/roles` viajaban juntos en una fusión compartida por ocho
 * pantallas. Al crecer el grafo, turbopack la partió y una de las dos piezas se copió dentro de
 * cada pantalla (`/camara` bajaba cuatro copias de `roles`). Van ancladas en pareja: con una sola,
 * la otra se duplica.
 */
export const SHELL_PINS = [expandAvoid, Checkbox, roleCan] as const;
