import { z } from "zod";

import { DEVICE_NAME_MAX } from "@/lib/device";

import {
  fingerprint,
  hashOf,
  PUB_RE,
  sign,
  SIG_RE,
  verify,
  type Signer,
} from "./sign";

/**
 * Quién puede qué en la familia (S9 · ADR-013 · G-Plan 1a).
 *
 * El roster es una CADENA de cambios firmados: el primero (génesis) lo firma quien crea la
 * familia, que es padre; cada cambio siguiente nombra el hash del anterior y lo firma un padre
 * del roster que había hasta ese punto. Así:
 *   - nadie que no sea padre puede darse ni darle un rol a otro (su firma no vale);
 *   - un roster alterado no encadena (hash o firma no coinciden) y se descarta entero;
 *   - un roster viejo repetido es más corto que el que este teléfono ya tiene y se ignora;
 *   - un teléfono que entra comprueba la huella del génesis que trae la invitación: aunque
 *     alguien con la frase cambie el roster del servidor, el teléfono nuevo no lo acepta.
 *
 * Todo esto viaja DENTRO de lo cifrado: el servidor no ve roles, nombres ni llaves.
 */

export const ROLES = ["parent", "caregiver", "school", "nutritionist"] as const;
export type Role = (typeof ROLES)[number];

/** Cambios de roster que caben holgados en un registro (≈ 400 B cada uno, tope 64 KB). */
export const ROSTER_MAX_OPS = 120;
/** Una invitación sin usar deja de valer a los 7 días. */
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
export const INVITE_TAG = /^[0-9A-HJKMNP-TV-Z]{4}$/;

const deviceId = z.string().min(1).max(24);
const mealId = z.string().min(1).max(60);

export const memberSchema = z
  .object({
    id: deviceId,
    name: z.string().trim().min(1).max(DEVICE_NAME_MAX),
    role: z.enum(ROLES),
    pub: z.string().regex(PUB_RE),
    /** Solo colegio: las comidas (ids del menú) que puede marcar. */
    meals: z.array(mealId).max(12).optional(),
  })
  .strict();
export type Member = z.infer<typeof memberSchema>;

const bodySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("genesis"),
      members: z.array(memberSchema).min(1).max(30),
    })
    .strict(),
  z
    .object({
      type: z.literal("set"),
      member: memberSchema,
      invite: z.string().regex(INVITE_TAG).optional(),
    })
    .strict(),
  z.object({ type: z.literal("remove"), id: deviceId }).strict(),
  z
    .object({
      type: z.literal("invite"),
      tag: z.string().regex(INVITE_TAG),
      role: z.enum(ROLES),
      meals: z.array(mealId).max(12).optional(),
    })
    .strict(),
]);
export type OpBody = z.infer<typeof bodySchema>;

export const opSchema = z
  .object({
    i: z.number().int().nonnegative(),
    prev: z.string().max(64),
    t: z.number().int().nonnegative(),
    by: deviceId,
    body: bodySchema,
    s: z.string().regex(SIG_RE),
  })
  .strict();
export type Op = z.infer<typeof opSchema>;

export const rosterSchema = z
  .object({ ops: z.array(opSchema).min(1).max(ROSTER_MAX_OPS) })
  .strict();
export type RosterShared = z.infer<typeof rosterSchema>;

export type Invite = {
  tag: string;
  role: Role;
  meals?: string[];
  t: number;
  by: string;
};
export type Roster = {
  members: Record<string, Member>;
  invites: Record<string, Invite>;
  /** Hash del último cambio. */
  head: string;
  /** Huella del génesis: la que lleva la invitación. */
  pin: string;
};

const signed = (op: Omit<Op, "s">) => ({ n: "roster", ...op });
export const opHash = (op: Op) => hashOf(op);

function apply(r: Roster, op: Op): boolean {
  const b = op.body;
  if (b.type === "genesis") return false;
  if (b.type === "set") {
    if (b.member.role !== "school" && b.member.meals) return false;
    const prev = r.members[b.member.id];
    // La llave de una persona no se cambia por la puerta de atrás: un teléfono = una llave.
    if (prev && prev.pub !== b.member.pub) return false;
    r.members[b.member.id] = b.member;
    if (b.invite) delete r.invites[b.invite];
  } else if (b.type === "remove") {
    if (!r.members[b.id]) return false;
    delete r.members[b.id];
  } else {
    if (b.role !== "school" && b.meals) return false;
    r.invites[b.tag] = {
      tag: b.tag,
      role: b.role,
      meals: b.meals,
      t: op.t,
      by: op.by,
    };
  }
  return Object.values(r.members).some((m) => m.role === "parent");
}

/**
 * Recorre la cadena desde el génesis y devuelve el roster que resulta, o null si un solo
 * eslabón no encaja: forma, orden, hash del anterior, firma, o que quien firma no sea padre.
 */
export async function foldRoster(raw: unknown): Promise<Roster | null> {
  const parsed = rosterSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ops = parsed.data.ops;
  const g = ops[0];
  if (g.i !== 0 || g.prev !== "" || g.body.type !== "genesis") return null;
  const founder = g.body.members.find((m) => m.id === g.by);
  if (!founder || founder.role !== "parent") return null;
  const ids = new Set(g.body.members.map((m) => m.id));
  if (ids.size !== g.body.members.length) return null;
  if (g.body.members.some((m) => m.role !== "school" && m.meals)) return null;
  const { s: gs, ...gRest } = g;
  if (!(await verify(founder.pub, signed(gRest), gs))) return null;
  const head0 = await opHash(g);
  const r: Roster = {
    members: Object.fromEntries(g.body.members.map((m) => [m.id, m])),
    invites: {},
    head: head0,
    pin: fingerprint(head0),
  };
  for (let k = 1; k < ops.length; k++) {
    const op = ops[k];
    if (op.i !== k || op.prev !== r.head) return null;
    const signer = r.members[op.by];
    if (!signer || signer.role !== "parent") return null;
    const { s, ...rest } = op;
    if (!(await verify(signer.pub, signed(rest), s))) return null;
    if (!apply(r, op)) return null;
    r.head = await opHash(op);
  }
  return r;
}

/** Un cambio nuevo, firmado por este teléfono, encadenado al final de `ops`. */
export async function appendOp(
  ops: Op[],
  signer: Signer,
  by: string,
  t: number,
  body: OpBody,
): Promise<Op> {
  const last = ops.at(-1);
  const base = {
    i: ops.length,
    prev: last ? await opHash(last) : "",
    t,
    by,
    body,
  };
  return { ...base, s: await sign(signer, signed(base)) };
}

export type ChainChoice =
  | { take: "remote"; roster: Roster; replay: Op[] }
  | { take: "local" }
  | { take: "reject"; why: "invalid" | "pin" };

/**
 * ¿Qué roster vale en este teléfono? El remoto, si encadena y es la continuación del local;
 * el local, si el remoto es un pedazo viejo de él (repetido); y si dos padres cambiaron a la
 * vez (bifurcación), gana el cambio más temprano (o el de hash menor) y este teléfono vuelve
 * a firmar encima los cambios suyos que perdieron (`replay`). Un génesis distinto solo se
 * acepta si este teléfono aún no fijó la huella (familia del S7 que migra).
 */
export async function chooseChain(
  local: Op[],
  remoteRaw: unknown,
  pin: string | null,
  own: string,
): Promise<ChainChoice> {
  const remote = await foldRoster(remoteRaw);
  if (!remote) return { take: "reject", why: "invalid" };
  if (pin && remote.pin !== pin) return { take: "reject", why: "pin" };
  const rops = (remoteRaw as RosterShared).ops;
  if (local.length === 0) return { take: "remote", roster: remote, replay: [] };
  let p = 0;
  while (
    p < local.length &&
    p < rops.length &&
    (await opHash(local[p])) === (await opHash(rops[p]))
  )
    p++;
  if (p === local.length)
    return rops.length > local.length
      ? { take: "remote", roster: remote, replay: [] }
      : { take: "local" };
  if (p === rops.length) return { take: "local" };
  const [hl, hr] = [await opHash(local[p]), await opHash(rops[p])];
  const remoteWins =
    rops[p].t !== local[p].t ? rops[p].t < local[p].t : hr < hl;
  if (!remoteWins) return { take: "local" };
  const replay = local
    .slice(p)
    .filter((op) => op.by === own && op.body.type !== "genesis");
  return { take: "remote", roster: remote, replay };
}

// ---------------------------------------------------------------------------
// Qué puede escribir cada rol
// ---------------------------------------------------------------------------

export type Write =
  | { k: "plan" }
  | { k: "textures" }
  | { k: "profile-note" }
  | { k: "mark"; check: string }
  | { k: "day-note"; check: string }
  | { k: "notice" }
  | { k: "roster" }
  // S10 · bienestar (ADR-015): el semáforo y la aceptación van con su comida; cómo está y los
  // hábitos son del día; la franja de edad es del perfil.
  | { k: "mood"; check: string }
  | { k: "food"; meal: string }
  | { k: "well" }
  | { k: "habit" }
  | { k: "age" }
  // S11 · lonchera (ADR-017): lo que va en la lonchera del día, y el nombre de la etiqueta.
  | { k: "lunch" }
  | { k: "lunch-label" }
  // S14 · «cuando le ofrecen algo» (ADR-020, G-Plan 1a): cualquiera de la familia anota lo suyo.
  | { k: "pressure" };

/** Todas las clases de escritura, para la prueba de permisos de cada rol contra cada una. */
export const WRITE_KINDS = [
  "plan",
  "textures",
  "profile-note",
  "mark",
  "day-note",
  "notice",
  "roster",
  "mood",
  "food",
  "well",
  "habit",
  "age",
  "lunch",
  "lunch-label",
  "pressure",
] as const satisfies readonly Write["k"][];

/** El corazón de los permisos: lo usan la pantalla (esconde) y la sincronía (descarta). */
export function may(
  member: Pick<Member, "role" | "meals"> | null | undefined,
  w: Write,
): boolean {
  if (!member) return false;
  switch (member.role) {
    case "parent":
      return true;
    case "caregiver":
      return (
        w.k === "mark" ||
        w.k === "day-note" ||
        w.k === "notice" ||
        w.k === "mood" ||
        w.k === "food" ||
        w.k === "well" ||
        w.k === "habit" ||
        w.k === "lunch" ||
        w.k === "pressure"
      );
    case "school":
      if (w.k === "notice" || w.k === "pressure") return true;
      if (w.k === "mark" || w.k === "day-note" || w.k === "mood") {
        const m = /^meal:(.+)$/.exec(w.check);
        return !!m && (member.meals ?? []).includes(m[1]);
      }
      // La aceptación se anota con la comida a la que pertenece: solo las de su franja.
      if (w.k === "food") return (member.meals ?? []).includes(w.meal);
      return false;
    case "nutritionist":
      return (
        w.k === "day-note" || w.k === "profile-note" || w.k === "pressure"
      );
  }
}

/** Una etiqueta corta para invitar (4 caracteres Crockford). */
export function newInviteTag(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes]
    .map((b) => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[b & 31])
    .join("");
}
