import type {
  FamilyMeta,
  FamilyStore,
  PullPage,
  PushItem,
  PushOutcome,
  StoredRecord,
} from "./store";

/**
 * El doble del almacén, en memoria: el que usan la CI y las e2e (`FAMILY_STORE=memory`).
 * Misma conducta que Upstash (la prueba de contrato corre las dos). Nada persiste: se
 * pierde al cerrar el servidor. Los vencimientos se ignoran salvo en los contadores.
 */

type Family = FamilyMeta & { seq: number; records: Map<string, StoredRecord> };
type State = {
  families: Map<string, Family>;
  counters: Map<string, { n: number; until: number }>;
};

function fresh(): State {
  return { families: new Map(), counters: new Map() };
}

// Una sola instancia por proceso (en dev, el recargado de módulos no la duplica).
const g = globalThis as { __nkFamilyMemory?: State };

export function createMemoryStore(
  options: { isolated?: boolean; now?: () => number } = {},
): FamilyStore {
  const state = options.isolated ? fresh() : (g.__nkFamilyMemory ??= fresh());
  const now = options.now ?? Date.now;
  const live = (family: string, epoch: number) => {
    const f = state.families.get(family);
    return f && f.epoch === epoch ? f : null;
  };

  return {
    label: "memory",
    async create(family, salt, tokenHash) {
      if (state.families.has(family)) return false;
      state.families.set(family, {
        salt,
        tokenHash,
        epoch: 1,
        seq: 0,
        records: new Map(),
      });
      return true;
    },
    async meta(family) {
      const f = state.families.get(family);
      return f
        ? { salt: f.salt, tokenHash: f.tokenHash, epoch: f.epoch }
        : null;
    },
    async pull(family, epoch, since, maxBytes): Promise<PullPage | null> {
      const f = live(family, epoch);
      if (!f) return null;
      const all = [...f.records.values()]
        .filter((r) => r.seq > since)
        .sort((a, b) => a.seq - b.seq);
      const records: StoredRecord[] = [];
      let bytes = 0;
      let more = false;
      for (const r of all) {
        const size = r.ct.length + r.iv.length;
        if (records.length > 0 && bytes + size > maxBytes) {
          more = true;
          break;
        }
        bytes += size;
        records.push({ ...r });
      }
      return { seq: f.seq, more, records };
    },
    async push(
      family,
      epoch,
      items: PushItem[],
      maxRecords,
    ): Promise<PushOutcome[] | null> {
      const f = live(family, epoch);
      if (!f) return null;
      return items.map((item) => {
        const cur = f.records.get(item.id);
        const ver = cur?.ver ?? 0;
        if (ver !== item.ver) return { status: "conflict", ver };
        if (!cur && f.records.size >= maxRecords)
          return { status: "full", ver: 0 };
        f.seq += 1;
        f.records.set(item.id, { ...item, ver: ver + 1, seq: f.seq });
        return { status: "ok", ver: ver + 1 };
      });
    },
    async rotate(family, epoch, salt, tokenHash) {
      const f = live(family, epoch);
      if (!f) return null;
      f.epoch += 1;
      f.salt = salt;
      f.tokenHash = tokenHash;
      f.records.clear();
      return f.epoch;
    },
    async destroy(family) {
      state.families.delete(family);
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
