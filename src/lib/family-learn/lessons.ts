/**
 * Educación a familiares (S14 · ADR-020): micro-lecciones para quien cuida al niño, que se leen
 * en menos de dos minutos. Contenido del repo, redactado en cada idioma (no traducido), con su
 * fuente por lección. Se PARAFRASEA: ninguna lección copia la hoja de una fuente, y las del
 * Ellyn Satter Institute (que no se pueden modificar) solo se citan.
 *
 * Reglas del contenido, con prueba (`tests/unit/family-learn.test.ts`): sin culpa ni regaño, la
 * comida jamás es premio ni castigo, nada de negociar bocados, sin cifras, sin indicación médica
 * y sin contradecir el plan (lo que se ofrece sale siempre del plan cargado).
 */

type Bi = { es: string; en: string };

export const LESSON_SOURCE_IDS = [
  "aap-mealtime",
  "aap-picky",
  "aap-praise",
  "satter-dor",
  "usda-nesr",
] as const;
export type LessonSourceId = (typeof LESSON_SOURCE_IDS)[number];

export type LessonSource = { id: LessonSourceId; cite: Bi };

/** Leídas el 2026-11-24 (las URL, en el ADR-020). */
export const LESSON_SOURCES: Record<LessonSourceId, LessonSource> = {
  "aap-mealtime": {
    id: "aap-mealtime",
    cite: {
      es: "AAP · HealthyChildren.org · «How to Handle Mealtime Struggles and Build Healthy Eating Habits in Children» (adaptada de «Tips for Preventing Food Hassles»)",
      en: "AAP · HealthyChildren.org · “How to Handle Mealtime Struggles and Build Healthy Eating Habits in Children” (adapted from “Tips for Preventing Food Hassles”)",
    },
  },
  "aap-picky": {
    id: "aap-picky",
    cite: {
      es: "AAP · HealthyChildren.org · «10 Tips for Parents of Picky Eaters» (Comité de Nutrición de la AAP)",
      en: "AAP · HealthyChildren.org · “10 Tips for Parents of Picky Eaters” (AAP Committee on Nutrition)",
    },
  },
  "aap-praise": {
    id: "aap-praise",
    cite: {
      es: "AAP · HealthyChildren.org · «Emotional Eating» (solo su parte sobre elogiar con palabras y premiar sin comida)",
      en: "AAP · HealthyChildren.org · “Emotional Eating” (only its part on praising with words and rewarding without food)",
    },
  },
  "satter-dor": {
    id: "satter-dor",
    cite: {
      es: "Ellyn Satter Institute · «The Satter Division of Responsibility in Feeding» (parafraseada y citada; sus hojas no se modifican)",
      en: "Ellyn Satter Institute · “The Satter Division of Responsibility in Feeding” (paraphrased and cited; its handouts are not modified)",
    },
  },
  "usda-nesr": {
    id: "usda-nesr",
    cite: {
      es: "USDA NESR · revisiones sistemáticas sobre la exposición repetida y la aceptación de alimentos (de cero a dos años, y de dos a seis años)",
      en: "USDA NESR · systematic reviews on repeated exposure and food acceptance (birth to two years, and two to six years)",
    },
  },
};

export const LESSON_IDS = [
  "support",
  "not-a-prize",
  "no-forcing",
  "many-tries",
  "when-asked",
] as const;
export type LessonId = (typeof LESSON_IDS)[number];

export type Lesson = {
  id: LessonId;
  title: Bi;
  /** La idea en una línea. */
  gist: Bi;
  /** Lo que conviene saber, en párrafos cortos. */
  points: Bi[];
  /** Frases que puedes decir tal cual. */
  say: Bi[];
  sources: LessonSourceId[];
};

export const LESSONS: Lesson[] = [
  {
    id: "support",
    title: { es: "Apoyar sin regañar", en: "Support without scolding" },
    gist: {
      es: "Tu parte es que comer sea un rato tranquilo y en compañía, no vigilar cada bocado.",
      en: "Your part is making meals calm and shared, not watching every bite.",
    },
    points: [
      {
        es: "Lo que más ayuda es que se sienta a gusto en la mesa. Sentarse juntos, sin pantallas, y conversar de otra cosa hace más que cualquier insistencia.",
        en: "What helps most is that eating feels relaxed. Sitting together, screens off, and talking about something else does more than any insisting.",
      },
      {
        es: "Si una comida no salió como esperabas, no hace falta un sermón. Lo que sigue es la próxima comida, con la misma calma.",
        en: "If a meal didn't go as you hoped, there's no need for a lecture. What comes next is the next meal, just as calm.",
      },
      {
        es: "Nombra lo que sí hizo, con palabras concretas. Un elogio con palabras anima más que una crítica.",
        en: "Name what your child did do, in concrete words. Praise in words encourages more than criticism.",
      },
      {
        es: "En la mesa no se habla mal de la comida: ni de la suya ni de la de nadie.",
        en: "At the table nobody talks badly about food: not your child's, not anyone's.",
      },
    ],
    say: [
      {
        es: "«Me gusta comer contigo.»",
        en: "“I like eating with you.”",
      },
      {
        es: "«Gracias por ayudarme a poner la mesa.»",
        en: "“Thanks for helping me set the table.”",
      },
    ],
    sources: ["satter-dor", "aap-praise", "aap-mealtime"],
  },
  {
    id: "not-a-prize",
    title: {
      es: "La comida no es premio ni castigo",
      en: "Food is not a prize or a punishment",
    },
    gist: {
      es: "La comida alimenta. No se usa para premiar, consolar ni castigar.",
      en: "Food nourishes. It isn't used to reward, comfort or punish.",
    },
    points: [
      {
        es: "Cuando un dulce se vuelve premio, se vuelve más deseado, y lo demás del plato empieza a parecer una tarea.",
        en: "When a treat becomes a prize, it becomes more wanted, and the rest of the plate starts to feel like a chore.",
      },
      {
        es: "Para celebrar hay muchas otras formas: un abrazo, elegir el juego de la tarde, una pegatina o contar en voz alta lo que logró.",
        en: "There are many other ways to celebrate: a hug, choosing the afternoon game, a sticker, or saying out loud what your child managed.",
      },
      {
        es: "Lo que come sale de su plan, no de cómo fue el día. Una comida no se quita ni se gana.",
        en: "What your child eats comes from the plan, not from how the day went. A meal is never taken away or earned.",
      },
    ],
    say: [
      {
        es: "«¡Lo lograste! ¿Lo celebramos jugando juntos?»",
        en: "“You did it! Shall we celebrate by playing together?”",
      },
    ],
    sources: ["aap-mealtime", "aap-picky", "aap-praise"],
  },
  {
    id: "no-forcing",
    title: {
      es: "No forzar ni negociar bocados",
      en: "No forcing, no bargaining over bites",
    },
    gist: {
      es: "El adulto decide qué, cuándo y dónde; el niño decide si come y cuánto.",
      en: "The adult decides what, when and where; the child decides whether and how much.",
    },
    points: [
      {
        es: "Tú eliges qué se sirve (de su plan), a qué hora y dónde se come. Él decide si come y cuánto de lo que hay en su plato.",
        en: "You choose what is served (from the plan), when and where. Your child decides whether to eat and how much of what is on the plate.",
      },
      {
        es: "Insistir, presionar o castigar para que coma suele hacer que le guste menos justo lo que quizá le habría gustado.",
        en: "Insisting, pressuring or punishing to get a child to eat tends to make them like less the very food they might have liked.",
      },
      {
        es: "Si no quiere, no se negocia ni se cocina otra cosa aparte. Se queda en la mesa sin drama, y luego llega la siguiente comida de su plan.",
        en: "If they don't want it, there's no bargaining and no separate dish. It stays on the table without drama, and then the next meal in the plan comes.",
      },
      {
        es: "Pon en el plato, junto a lo nuevo, algo de su plan que ya acepta.",
        en: "Put something from the plan that they already accept on the plate, next to the new food.",
      },
    ],
    say: [
      {
        es: "«No tienes que comerlo. Puede quedarse en tu plato.»",
        en: "“You don't have to eat it. It can stay on your plate.”",
      },
    ],
    sources: ["satter-dor", "aap-picky", "aap-mealtime"],
  },
  {
    id: "many-tries",
    title: {
      es: "Probar muchas veces, sin presión",
      en: "Many tries, no pressure",
    },
    gist: {
      es: "Aceptar algo nuevo suele tomar muchas ofertas. Que al principio lo rechace es normal.",
      en: "Accepting something new often takes many offers. Refusing it at first is normal.",
    },
    points: [
      {
        es: "Un alimento nuevo de su plan se ofrece muchas veces, en días distintos, sin pedirle que lo coma.",
        en: "A new food from the plan is offered many times, on different days, without asking them to eat it.",
      },
      {
        es: "Mirarlo, olerlo, tocarlo o ayudar a prepararlo ya cuenta: es conocerlo.",
        en: "Looking at it, smelling it, touching it or helping to prepare it already counts: it's getting to know it.",
      },
      {
        es: "Ayuda que te vea comerlo a ti, sin comentarios.",
        en: "It helps when they see you eat it, with no comments.",
      },
      {
        es: "En Bienestar puedes anotar cada vez que lo conoció. La app no pone metas.",
        en: "In Wellbeing you can note each time they got to know it. The app sets no goals.",
      },
    ],
    say: [
      {
        es: "«Hoy solo lo miramos. Otro día lo vemos otra vez.»",
        en: "“Today we're just looking at it. We'll see it again another day.”",
      },
    ],
    sources: ["usda-nesr", "aap-picky", "aap-mealtime"],
  },
  {
    id: "when-asked",
    title: {
      es: "Cuando pide lo que no puede",
      en: "When they ask for what they can't have",
    },
    gist: {
      es: "Reconoce las ganas, di el límite corto y tranquilo, y ofrece algo que sí está en su plan.",
      en: "Acknowledge the wanting, say the limit briefly and calmly, and offer something that is in the plan.",
    },
    points: [
      {
        es: "Querer eso es normal. Nombrar lo que siente lo calma más que discutir.",
        en: "Wanting it is normal. Naming what they feel calms them more than arguing.",
      },
      {
        es: "El límite va corto y sin amenazas ni explicaciones largas. La decisión es del adulto, así que no se negocia.",
        en: "The limit is short, with no threats or long explanations. The decision is the adult's, so it isn't bargained.",
      },
      {
        es: "Ofrece algo verde de su plan y cambia de tema o de actividad.",
        en: "Offer something green from the plan and change the subject or the activity.",
      },
      {
        es: "Si alguien más se lo ofreció, no hace falta discutir delante de él: agradece, ofrece la alternativa y conversa con esa persona después, con calma. Puedes anotarlo en «Cuando le ofrecen algo».",
        en: "If someone else offered it, there's no need to argue in front of your child: say thanks, offer the alternative and talk with that person later, calmly. You can note it in “When someone offers something”.",
      },
    ],
    say: [
      {
        es: "«Entiendo que lo quieres, se ve rico. Eso no está en tu plan. ¿Quieres esto otro?»",
        en: "“I know you want it, it looks good. That's not in your plan. Would you like this instead?”",
      },
    ],
    sources: ["satter-dor", "aap-mealtime", "aap-picky"],
  },
];

/** Todo el texto de una lección en un idioma (para las pruebas de contenido y el conteo de palabras). */
export function lessonText(l: Lesson, locale: "es" | "en"): string {
  return [
    l.title[locale],
    l.gist[locale],
    ...l.points.map((p) => p[locale]),
    ...l.say.map((s) => s[locale]),
  ].join("\n");
}

/** Palabras que caben en dos minutos de lectura tranquila (≈ 150 por minuto, con holgura). */
export const LESSON_MAX_WORDS = 280;
