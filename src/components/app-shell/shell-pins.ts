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
import { expandAvoid } from "@/lib/diet/allergen-families";

export const SHELL_PINS = [expandAvoid] as const;
