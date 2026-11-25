import type { Source } from "@/lib/adventure/energy";
import type { World } from "@/lib/adventure/store";

import type { Locale } from "./index";

/**
 * Textos de la aventura del modo niño (S14 · ADR-020, parte 2), en su propio módulo: solo los
 * carga `/aventura`. Redactados en cada idioma (no traducidos); paridad y frases vetadas por test
 * (`tests/unit/adventure.test.ts`). La comida jamás es premio, la energía jamás baja y nada urge.
 */

type WorldText = {
  /** Nombre del mundo («El huerto de Brote»). */
  name: string;
  /** Nombre corto del personaje, para el selector. */
  short: string;
  hi: string;
  sub: string;
  /** Lo que ve quien no ve la imagen. */
  scene: string;
  unitOne: string;
  unitMany: string;
  /** «Con {n} … más». */
  next: string;
  nextOne: string;
  full: string;
  tiles: Record<Source, string>;
};

type Text = {
  /** Selector de mundo. */
  pickTitle: string;
  pickCurrent: string;
  done: string;
  /** Encabezado de la lista de hábitos, para lectores de pantalla. */
  habitsTitle: string;
  kitchenHint: string;
  worlds: Record<World, WorldText>;
  /** Pantalla del adulto (sin modo niño). */
  adultTitle: string;
  adultLead: string;
  adultRule: string;
  adultOn: string;
  adultOnNote: string;
  adultBack: string;
  /** Salida del adulto (con modo niño). */
  exit: string;
  exitHold: string;
  exitHolding: string;
  exitTitle: string;
  exitSum: string;
  exitField: string;
  exitConfirm: string;
  exitStay: string;
  exitWrong: string;
  notMedical: string;
};

const es: Text = {
  pickTitle: "Elige tu mundo",
  pickCurrent: "Este es el tuyo ahora",
  done: "hecho",
  habitsTitle: "Lo que cuidaste hoy",
  kitchenHint: "Toca cuando ayudes en la cocina",
  worlds: {
    brote: {
      name: "El huerto de Brote",
      short: "Brote",
      hi: "¡Hola! Soy Brote",
      sub: "Cada cosa que cuidas hoy riega el huerto.",
      scene: "Brote, una semilla con dos hojas, en su huerto de flores.",
      unitOne: "gota",
      unitMany: "gotas",
      next: "Con {n} gotas más nace una flor nueva.",
      nextOne: "Con una gota más nace una flor nueva.",
      full: "El huerto está en flor. Las gotas siguen sumando.",
      tiles: {
        sleep: "Dormí",
        activity: "Jugué y me moví",
        water: "Tomé agua",
        sun: "Salí al sol",
        kitchen: "Ayudé en la cocina",
        try: "Conocí algo nuevo",
      },
    },
    lumo: {
      name: "La expedición de Lumo",
      short: "Lumo",
      hi: "Lumo sigue el camino",
      sub: "Tus chispas alumbran el mapa.",
      scene: "Lumo, un explorador con un farol, sobre un mapa con un camino.",
      unitOne: "chispa de luz",
      unitMany: "chispas de luz",
      next: "La próxima parada se alumbra con {n} chispas más.",
      nextOne: "La próxima parada se alumbra con una chispa más.",
      full: "Todo el mapa está alumbrado. Las chispas siguen sumando.",
      tiles: {
        sleep: "Dormí",
        activity: "Me moví",
        water: "Agua",
        sun: "Sol",
        kitchen: "Cociné",
        try: "Algo nuevo",
      },
    },
    nubo: {
      name: "El cielo de Nubo",
      short: "Nubo",
      hi: "Nubo junta estrellas",
      sub: "Cada cosa que cuidas enciende una.",
      scene: "Nubo, una nube sonriente, junto a una cometa hecha de estrellas.",
      unitOne: "estrella",
      unitMany: "estrellas",
      next: "Con {n} estrellas más se enciende otra de la cometa.",
      nextOne: "Con una estrella más se enciende otra de la cometa.",
      full: "La cometa está completa. Las estrellas siguen sumando.",
      tiles: {
        sleep: "Dormí",
        activity: "Jugué y me moví",
        water: "Tomé agua",
        sun: "Salí al sol",
        kitchen: "Ayudé a cocinar",
        try: "Conocí algo nuevo",
      },
    },
  },
  adultTitle: "La aventura de tu peque",
  adultLead:
    "Un juego para que juegue en tu teléfono sin ver el plan ni los ajustes. Elige su mundo y le deja la aventura sola.",
  adultRule:
    "La energía sale de dormir, moverse o jugar, el agua, el sol, ayudar en la cocina y conocer algo nuevo (mirarlo o tocarlo cuenta igual que probarlo). Nunca sale de comer, y nunca baja.",
  adultOn: "Activar modo niño",
  adultOnNote:
    "El teléfono se queda en la aventura hasta que un adulto salga, mantenga pulsado y resuelva una suma.",
  adultBack: "Volver a Hoy",
  exit: "Salir · adulto",
  exitHold: "Mantén pulsado dos segundos",
  exitHolding: "Sigue pulsando…",
  exitTitle: "Solo para adultos",
  exitSum: "¿Cuánto es {a} más {b}? Escribe el resultado con números.",
  exitField: "Resultado",
  exitConfirm: "Salir del modo niño",
  exitStay: "Quedarme en la aventura",
  exitWrong: "Esa no es la cuenta. Prueba otra vez.",
  notMedical: "Esta guía no reemplaza a tu pediatra.",
};

const en: Text = {
  pickTitle: "Pick your world",
  pickCurrent: "This one is yours now",
  done: "done",
  habitsTitle: "What you looked after today",
  kitchenHint: "Tap when you help in the kitchen",
  worlds: {
    brote: {
      name: "Brote's garden",
      short: "Brote",
      hi: "Hi! I'm Brote",
      sub: "Everything you look after today waters the garden.",
      scene: "Brote, a seed with two leaves, in a garden full of flowers.",
      unitOne: "drop",
      unitMany: "drops",
      next: "{n} more drops and a new flower blooms.",
      nextOne: "One more drop and a new flower blooms.",
      full: "The garden is in bloom. The drops keep adding up.",
      tiles: {
        sleep: "I slept",
        activity: "I played and moved",
        water: "I drank water",
        sun: "I went in the sun",
        kitchen: "I helped in the kitchen",
        try: "I met something new",
      },
    },
    lumo: {
      name: "Lumo's expedition",
      short: "Lumo",
      hi: "Lumo follows the path",
      sub: "Your sparks light up the map.",
      scene: "Lumo, an explorer with a lantern, on a map with a winding path.",
      unitOne: "spark of light",
      unitMany: "sparks of light",
      next: "{n} more sparks light up the next stop.",
      nextOne: "One more spark lights up the next stop.",
      full: "The whole map is lit. The sparks keep adding up.",
      tiles: {
        sleep: "I slept",
        activity: "I moved",
        water: "Water",
        sun: "Sun",
        kitchen: "I cooked",
        try: "Something new",
      },
    },
    nubo: {
      name: "Nubo's sky",
      short: "Nubo",
      hi: "Nubo gathers stars",
      sub: "Everything you look after lights one up.",
      scene: "Nubo, a smiling cloud, next to a kite made of stars.",
      unitOne: "star",
      unitMany: "stars",
      next: "{n} more stars light up another one on the kite.",
      nextOne: "One more star lights up another one on the kite.",
      full: "The kite is complete. The stars keep adding up.",
      tiles: {
        sleep: "I slept",
        activity: "I played and moved",
        water: "I drank water",
        sun: "I went in the sun",
        kitchen: "I helped cook",
        try: "I met something new",
      },
    },
  },
  adultTitle: "Your child's adventure",
  adultLead:
    "A game your child plays on your phone without seeing the plan or the settings. They pick a world and the adventure stays on its own.",
  adultRule:
    "Energy comes from sleeping, moving or playing, water, sun, helping in the kitchen and meeting something new (looking at it or touching it counts the same as tasting it). It never comes from eating, and it never goes down.",
  adultOn: "Turn on kid mode",
  adultOnNote:
    "The phone stays on the adventure until an adult exits, holds the button and solves a sum.",
  adultBack: "Back to Today",
  exit: "Exit · adult",
  exitHold: "Hold for two seconds",
  exitHolding: "Keep holding…",
  exitTitle: "Adults only",
  exitSum: "What is {a} plus {b}? Type the result with numbers.",
  exitField: "Result",
  exitConfirm: "Leave kid mode",
  exitStay: "Stay in the adventure",
  exitWrong: "That's not the sum. Try again.",
  notMedical: "This guide does not replace your pediatrician.",
};

export const adventureText: Record<Locale, Text> = { es, en };
export type AdventureText = Text;
