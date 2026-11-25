import type { Place } from "./values";

/**
 * Qué hacer según dónde pasa (S14 · ADR-020): un catálogo propio, redactado en cada idioma, por
 * tipo de situación. Es organización y trato entre adultos, no una indicación médica: no nombra
 * alimentos (lo que se ofrece en su lugar sale del plan cargado) y no culpa a nadie. Comparte la
 * idea de las lecciones: el adulto decide qué se ofrece, sin regañar y sin negociar bocados.
 */

type Bi = { es: string; en: string };

export type Strategy = {
  title: Bi;
  /** Pasos para la próxima vez, en orden. */
  steps: Bi[];
  /** Una frase para el adulto que lo ofreció. */
  sayAdult: Bi;
};

export const STRATEGIES: Record<Place, Strategy> = {
  relatives: {
    title: {
      es: "En casa de los abuelos o de la familia",
      en: "At the grandparents' or relatives' home",
    },
    steps: [
      {
        es: "Antes de la visita, comparte «Qué sí y qué no» con quien los recibe. Muchas veces ofrecen dulces por cariño, no por llevar la contraria.",
        en: "Before the visit, share “What yes and what no” with your hosts. They often offer treats out of love, not to go against you.",
      },
      {
        es: "Lleva algo de su plan que le guste, para que haya con qué compartir en la mesa.",
        en: "Bring something from the plan that your child likes, so there's something to share at the table.",
      },
      {
        es: "Propón otra forma de consentirlo: un cuento, un juego o cocinar juntos algo de su plan.",
        en: "Suggest another way to spoil your child: a story, a game, or cooking something from the plan together.",
      },
    ],
    sayAdult: {
      es: "«Gracias por pensar en él. Hoy le traje lo suyo; ¿lo preparamos juntos?»",
      en: "“Thanks for thinking of them. I brought their own today; shall we make it together?”",
    },
  },
  school: {
    title: { es: "En el colegio", en: "At school" },
    steps: [
      {
        es: "Comparte con el colegio «Qué sí y qué no» y lo que lleva en la lonchera.",
        en: "Share “What yes and what no” and what goes in the lunchbox with the school.",
      },
      {
        es: "Pregunta qué celebraciones vienen y deja algo de su plan para esos días.",
        en: "Ask which celebrations are coming and leave something from the plan for those days.",
      },
      {
        es: "Acuerda con la maestra una frase corta para cuando alguien le ofrezca algo.",
        en: "Agree with the teacher on a short phrase for when someone offers something.",
      },
    ],
    sayAdult: {
      es: "«Gracias por cuidarlo. Para las celebraciones le dejamos esto de su plan.»",
      en: "“Thanks for looking after them. For celebrations, we've left this from their plan.”",
    },
  },
  party: {
    title: { es: "En una fiesta", en: "At a party" },
    steps: [
      {
        es: "Lleva lo suyo para el momento de la torta o los dulces, y que lo coma junto a los demás.",
        en: "Bring their own for the cake or sweets moment, so they eat it alongside everyone.",
      },
      {
        es: "Avisa a quien organiza antes de llegar, con calma y sin dar explicaciones médicas.",
        en: "Let the host know before you arrive, calmly and without medical explanations.",
      },
      {
        es: "En la fiesta, lo importante es el juego: nombra lo divertido, no lo que no puede.",
        en: "At the party, play is what matters: name the fun, not what they can't have.",
      },
    ],
    sayAdult: {
      es: "«Gracias por invitarnos. Él trae lo suyo para compartir el momento con todos.»",
      en: "“Thanks for having us. They brought their own to share the moment with everyone.”",
    },
  },
  kids: {
    title: { es: "Entre otros niños", en: "Among other children" },
    steps: [
      {
        es: "Entre niños compartir es natural: no regañes a nadie, ni a él ni al otro niño.",
        en: "Sharing among children is natural: don't scold anyone, not your child or the other one.",
      },
      {
        es: "Dale algo de su plan para que él también pueda compartir.",
        en: "Give your child something from the plan so they can share too.",
      },
      {
        es: "Practiquen en casa una frase corta para decir «no, gracias».",
        en: "Practise a short “no, thank you” at home.",
      },
    ],
    sayAdult: {
      es: "«Qué lindo que compartan. Él tiene lo suyo; ¿lo cambian?»",
      en: "“How nice that they share. They have their own; want to swap?”",
    },
  },
  outing: {
    title: {
      es: "En una salida, tienda o restaurante",
      en: "On an outing, at a shop or restaurant",
    },
    steps: [
      {
        es: "Lleva algo de su plan que aguante sin nevera.",
        en: "Bring something from the plan that keeps without a fridge.",
      },
      {
        es: "Antes de salir, cuéntale qué va a haber para él.",
        en: "Before you go out, tell your child what there will be for them.",
      },
      {
        es: "Si alguien le regala algo, agradece y guárdalo sin hacer escena.",
        en: "If someone gives them something, say thanks and put it away without a scene.",
      },
    ],
    sayAdult: {
      es: "«Muy amable, gracias. Lo guardamos para después.»",
      en: "“That's very kind, thank you. We'll keep it for later.”",
    },
  },
  other: {
    title: { es: "En otro lugar", en: "Somewhere else" },
    steps: [
      {
        es: "Agradece la intención: casi siempre es cariño.",
        en: "Thank them for the thought: it's almost always kindness.",
      },
      {
        es: "Ofrece algo de su plan y cambia de tema o de actividad.",
        en: "Offer something from the plan and change the subject or the activity.",
      },
      {
        es: "Después, con calma, cuéntale a esa persona qué sí puede.",
        en: "Afterwards, calmly tell that person what they can have.",
      },
    ],
    sayAdult: {
      es: "«Gracias, qué amable. Él no puede comer eso, pero sí esto otro.»",
      en: "“Thank you, how kind. They can't have that, but they can have this.”",
    },
  },
};
