import type { AddOutcome, PushStore, PushSub } from "./store";

/**
 * El doble del registro de avisos, en memoria: el de la CI y las e2e (`FAMILY_STORE=memory`).
 * Misma conducta que Upstash (la prueba de contrato corre las dos). Los vencimientos se
 * respetan en los contadores y en las marcas de «enviado» y «saltar».
 */

type State = {
  subs: Map<string, PushSub>;
  flags: Map<string, number>;
  counters: Map<string, { n: number; until: number }>;
};

const fresh = (): State => ({
  subs: new Map(),
  flags: new Map(),
  counters: new Map(),
});
const g = globalThis as { __nkPushMemory?: State };

export function createMemoryPushStore(
  options: { isolated?: boolean; now?: () => number } = {},
): PushStore {
  const state = options.isolated ? fresh() : (g.__nkPushMemory ??= fresh());
  const now = options.now ?? Date.now;
  const inFamily = (family: string) =>
    [...state.subs.values()].filter((s) => s.family === family);
  const flag = (key: string) => {
    const until = state.flags.get(key);
    if (until !== undefined && until <= now()) state.flags.delete(key);
    return state.flags.has(key);
  };
  const copy = (s: PushSub): PushSub => ({
    ...s,
    wakes: s.wakes.map((w) => ({ ...w })),
  });

  return {
    label: "memory",
    async add(sub, maxTotal, maxPerFamily): Promise<AddOutcome> {
      if (state.subs.size >= maxTotal) return "full";
      if (sub.family && inFamily(sub.family).length >= maxPerFamily)
        return "family-full";
      state.subs.set(sub.id, copy(sub));
      return "ok";
    },
    async get(id) {
      const s = state.subs.get(id);
      return s ? copy(s) : null;
    },
    async put(sub, prev, maxPerFamily): Promise<AddOutcome> {
      if (
        sub.family &&
        sub.family !== prev.family &&
        inFamily(sub.family).length >= maxPerFamily
      )
        return "family-full";
      state.subs.set(sub.id, copy(sub));
      return "ok";
    },
    async remove(sub) {
      state.subs.delete(sub.id);
    },
    async all() {
      return [...state.subs.values()].map(copy);
    },
    async family(family) {
      return inFamily(family).map(copy);
    },
    async setSkip(id, date, m, on, ttl) {
      const key = `k:${id}:${date}:${m}`;
      if (on) state.flags.set(key, now() + ttl * 1000);
      else state.flags.delete(key);
    },
    async skipped(id, date, m) {
      return flag(`k:${id}:${date}:${m}`);
    },
    async markSent(id, date, m, ttl) {
      const key = `x:${id}:${date}:${m}`;
      if (flag(key)) return false;
      state.flags.set(key, now() + ttl * 1000);
      return true;
    },
    async count(key, windowSeconds) {
      const t = now();
      const c = state.counters.get(key);
      if (!c || c.until <= t) {
        state.counters.set(key, { n: 1, until: t + windowSeconds * 1000 });
        return 1;
      }
      c.n += 1;
      return c.n;
    },
  };
}
