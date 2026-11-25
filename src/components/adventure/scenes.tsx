import { STAGE_MAX } from "@/lib/adventure/energy";
import type { World } from "@/lib/adventure/store";

/**
 * Los tres mundos de la aventura (S14 · ADR-020, parte 2), dibujados como en `juego.html`, la
 * página que el dueño miró. `stage` (0 a 5) sale de la energía y es el mismo en los tres: el
 * mundo solo crece. Nada se marchita, se apaga ni se pierde de vista.
 */

const STAR =
  "M0 0 l4 8 9 1.5 -6.5 6 1.6 9 -8.1 -4.3 -8.1 4.3 1.6 -9 -6.5 -6 9 -1.5z";

const PLANTS = [
  { x: 40, top: 180, fy: 172, fr: 12, sr: 5, leaves: [[30, 205, 12, -30]] },
  {
    x: 90,
    top: 150,
    fy: 140,
    fr: 15,
    sr: 6,
    leaves: [
      [102, 190, 13, 30],
      [78, 205, 12, -30],
    ],
  },
  { x: 215, top: 160, fy: 150, fr: 14, sr: 6, leaves: [[227, 200, 13, 30]] },
  { x: 262, top: 196, fy: 188, fr: 10, sr: 4, leaves: [[252, 220, 11, -30]] },
] as const;

function Garden({ stage }: { stage: number }) {
  const grown = PLANTS.slice(0, Math.min(stage, PLANTS.length));
  return (
    <>
      <circle cx="250" cy="48" r="26" fill="var(--adv-petal)" opacity=".35" />
      <path
        d="M-300 250 H0 Q150 222 300 250 H600 V700 H-300z"
        fill="var(--adv-soil-soft)"
      />
      <path
        d="M-300 268 H0 Q150 244 300 268 H600"
        fill="none"
        stroke="var(--adv-soil)"
        strokeWidth="2"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
      {grown.map((p) => (
        <g key={p.x}>
          <path
            d={`M${p.x} ${p.top + 72} V${p.top}`}
            stroke="var(--adv-sage)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {p.leaves.map(([cx, cy, rx, rot]) => (
            <ellipse
              key={cx}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={rx / 2}
              transform={`rotate(${rot} ${cx} ${cy})`}
              fill="var(--adv-sage)"
            />
          ))}
          <circle cx={p.x} cy={p.fy} r={p.fr} fill="var(--adv-petal)" />
          <circle cx={p.x} cy={p.fy} r={p.sr} fill="var(--adv-seed)" />
        </g>
      ))}
      <path d="M140 252 q14 -14 28 0" fill="var(--adv-soil)" opacity=".6" />
      <g transform="translate(150 175)">
        <path
          d="M0 -40 C-6 -62 -26 -66 -34 -58 C-24 -48 -12 -44 0 -40z"
          fill="var(--adv-sage)"
        />
        <path
          d="M0 -40 C6 -64 28 -68 36 -58 C24 -48 12 -44 0 -40z"
          fill="var(--adv-sage)"
        />
        <path
          d="M0 -42 V-34"
          stroke="var(--adv-sage)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {stage >= STAGE_MAX && (
          <g fill="var(--adv-petal)">
            <circle cx="-16" cy="-52" r="7" />
            <circle cx="0" cy="-58" r="8" />
            <circle cx="16" cy="-52" r="7" />
          </g>
        )}
        <ellipse cx="0" cy="0" rx="36" ry="40" fill="var(--adv-seed)" />
        <ellipse
          cx="0"
          cy="10"
          rx="22"
          ry="20"
          fill="var(--background)"
          opacity=".35"
        />
        <circle cx="-12" cy="-6" r="4.5" fill="var(--adv-ink)" />
        <circle cx="12" cy="-6" r="4.5" fill="var(--adv-ink)" />
        <path
          d="M-10 8 Q0 17 10 8"
          fill="none"
          stroke="var(--adv-ink)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="-22" cy="4" r="5" fill="var(--adv-petal)" opacity=".45" />
        <circle cx="22" cy="4" r="5" fill="var(--adv-petal)" opacity=".45" />
        <ellipse
          cx="-14"
          cy="40"
          rx="9"
          ry="5"
          fill="var(--adv-ink)"
          opacity=".7"
        />
        <ellipse
          cx="14"
          cy="40"
          rx="9"
          ry="5"
          fill="var(--adv-ink)"
          opacity=".7"
        />
      </g>
      <g fill="var(--adv-sage)" opacity=".8">
        <path d="M60 60 c5 7 8 11 8 15 a8 8 0 0 1 -16 0 c0 -4 3 -8 8 -15z" />
        <path d="M180 40 c4 6 7 9 7 13 a7 7 0 0 1 -14 0 c0 -4 3 -7 7 -13z" />
        <path d="M120 80 c3 5 5 7 5 10 a5 5 0 0 1 -10 0 c0 -3 2 -5 5 -10z" />
      </g>
    </>
  );
}

const STOPS = [
  [30, 300],
  [85, 258],
  [130, 225],
  [200, 205],
  [230, 150],
  [160, 112],
  [160, 62],
  [270, 30],
] as const;
/** Cuánto del camino queda alumbrado en cada paso (de 100). */
const LIT = [0, 18, 43, 70, 100, 100] as const;

function Expedition({ stage }: { stage: number }) {
  return (
    <>
      <path
        d="M30 300 C90 290 60 230 130 225 S240 200 230 150 S120 110 150 70 S250 40 270 30"
        fill="none"
        stroke="var(--adv-trail)"
        strokeWidth="5"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      <path
        d="M30 300 C90 290 60 230 130 225 S240 200 230 150"
        pathLength={100}
        fill="none"
        stroke="var(--adv-amber)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${LIT[stage] ?? 100} 100`}
        opacity=".75"
      />
      {stage >= STAGE_MAX && (
        <path
          d="M230 150 C215 120 190 112 160 112"
          fill="none"
          stroke="var(--adv-amber)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity=".75"
        />
      )}
      {STOPS.map(([x, y], i) => {
        const lit = i <= stage;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={i === STOPS.length - 1 ? 13 : 11}
              fill={lit ? "var(--adv-amber)" : "var(--adv-paper)"}
              stroke="var(--adv-trail)"
              strokeWidth="3"
            />
            {lit && (
              <path
                d={`M${x - 5} ${y} l4 4 7 -8`}
                fill="none"
                stroke="var(--adv-ink)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
      <g
        stroke="var(--adv-trail)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M40 120 l18 -30 l18 30z" />
        <path d="M62 120 l14 -22 l14 22" />
        <path d="M230 270 q12 -16 24 0 q-12 10 -24 0z" />
        <path d="M242 262 v-14" />
      </g>
      <g transform="translate(232 112)">
        <circle
          className="adv-glow"
          cx="26"
          cy="6"
          r="34"
          fill="var(--adv-amber)"
          opacity=".6"
        />
        <ellipse cx="0" cy="10" rx="26" ry="24" fill="var(--adv-lumo)" />
        <path
          d="M-22 -4 l-6 -14 l12 6z M22 -4 l6 -14 l-12 6z"
          fill="var(--adv-lumo)"
        />
        <ellipse cx="0" cy="18" rx="15" ry="12" fill="var(--adv-lumo-belly)" />
        <circle cx="-9" cy="4" r="5.5" fill="var(--background)" />
        <circle cx="9" cy="4" r="5.5" fill="var(--background)" />
        <circle cx="-8" cy="5" r="3" fill="var(--adv-ink)" />
        <circle cx="10" cy="5" r="3" fill="var(--adv-ink)" />
        <path
          d="M-4 13 q4 4 8 0"
          fill="none"
          stroke="var(--adv-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M22 14 L26 -6"
          stroke="var(--adv-ink)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect
          x="18"
          y="-6"
          width="16"
          height="20"
          rx="4"
          fill="var(--adv-amber)"
          stroke="var(--adv-ink)"
          strokeWidth="2.4"
        />
        <path
          d="M22 -6 q4 -6 8 0"
          fill="none"
          stroke="var(--adv-ink)"
          strokeWidth="2.4"
        />
      </g>
    </>
  );
}

const KITE = [
  [150, 28],
  [210, 98],
  [150, 178],
  [90, 98],
  [150, 98],
] as const;
const TAIL = [
  [156, 230],
  [158, 268],
] as const;
/** Las líneas de la cometa, por la estrella que las enciende (índice en KITE). */
const KITE_LINES: [number, string][] = [
  [1, "M150 40 L210 110"],
  [2, "M210 110 L150 190"],
  [3, "M150 190 L90 110"],
  [3, "M90 110 L150 40"],
  [4, "M150 40 L150 190 M90 110 L210 110"],
];

function Sky({ stage }: { stage: number }) {
  return (
    <>
      <g
        stroke="var(--adv-star)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity=".9"
      >
        {KITE_LINES.filter(([n]) => n <= stage).map(([n, d]) => (
          <path key={d + n} d={d} />
        ))}
      </g>
      <path
        d="M150 190 q-10 25 6 40 q-14 20 2 38"
        fill="none"
        stroke="var(--adv-star-off)"
        strokeWidth="2.5"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
      {KITE.map(([x, y], i) =>
        i <= stage ? (
          <path
            key={i}
            transform={`translate(${x} ${y})`}
            d={STAR}
            fill="var(--adv-star)"
          />
        ) : (
          <circle
            key={i}
            cx={x + 6}
            cy={y + 12}
            r="6"
            fill="none"
            stroke="var(--adv-star-off)"
            strokeWidth="2"
          />
        ),
      )}
      {TAIL.map(([x, y], i) =>
        stage >= STAGE_MAX ? (
          <path
            key={i}
            transform={`translate(${x - 6} ${y - 12}) scale(.8)`}
            d={STAR}
            fill="var(--adv-star)"
          />
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="6"
            fill="none"
            stroke="var(--adv-star-off)"
            strokeWidth="2"
          />
        ),
      )}
      <g fill="var(--adv-star)" opacity=".5">
        <circle cx="40" cy="40" r="2" />
        <circle cx="260" cy="60" r="2" />
        <circle cx="30" cy="190" r="1.6" />
        <circle cx="270" cy="200" r="1.6" />
        <circle cx="240" cy="20" r="1.4" />
      </g>
      <g transform="translate(78 250)">
        <path
          d="M-36 14 a18 18 0 0 1 8 -32 a24 24 0 0 1 44 -4 a18 18 0 0 1 22 30 z"
          fill="var(--adv-nubo)"
        />
        <circle cx="-6" cy="0" r="3.6" fill="var(--adv-nubo-ink)" />
        <circle cx="12" cy="0" r="3.6" fill="var(--adv-nubo-ink)" />
        <path
          d="M-2 7 q5 5 10 0"
          fill="none"
          stroke="var(--adv-nubo-ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="-16" cy="6" r="4" fill="var(--adv-sky-2)" opacity=".4" />
        <circle cx="24" cy="6" r="4" fill="var(--adv-sky-2)" opacity=".4" />
      </g>
    </>
  );
}

export function Scene({
  world,
  stage,
  label,
}: {
  world: World;
  stage: number;
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 300 330"
      role="img"
      aria-label={label}
      className="absolute inset-0 size-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      {world === "brote" && <Garden stage={stage} />}
      {world === "lumo" && <Expedition stage={stage} />}
      {world === "nubo" && <Sky stage={stage} />}
    </svg>
  );
}
