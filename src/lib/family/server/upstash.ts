import type {
  FamilyStore,
  PullPage,
  PushItem,
  PushOutcome,
  StoredRecord,
} from "./store";

/**
 * La base real: Upstash Redis por su API REST (decisión 1 del G-Plan), con `fetch` y sin
 * dependencias. Cada operación que lee y escribe es UN script Lua: Redis lo corre entero
 * sin nada en medio, así la versión (409) y la época se comprueban y se escriben a la vez.
 *
 * Claves por familia (la etiqueta {…} las deja en la misma ranura):
 *   nk:{F}:m  hash  salt · th (huella del token) · ep (época) · seq (contador de escrituras)
 *   nk:{F}:r  hash  id → «ver:kind:iv:ct»   (base64url no lleva «:»)
 *   nk:{F}:z  zset  id por seq: lo cambiado desde una seq, en orden
 * Contadores de los topes: nk:c:<nombre>.
 *
 * Jamás se registra ni se reenvía el token de la base ni lo guardado.
 */

const CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'salt', ARGV[1], 'th', ARGV[2], 'ep', '1', 'seq', '0')
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`;

const PULL = `
if redis.call('HGET', KEYS[1], 'ep') ~= ARGV[1] then return false end
local out = {redis.call('HGET', KEYS[1], 'seq'), 0}
local ids = redis.call('ZRANGEBYSCORE', KEYS[3], '(' .. ARGV[2], '+inf', 'WITHSCORES')
local bytes = 0
local max = tonumber(ARGV[3])
for i = 1, #ids, 2 do
  local val = redis.call('HGET', KEYS[2], ids[i])
  if val then
    if bytes > 0 and bytes + #val > max then
      out[2] = 1
      break
    end
    bytes = bytes + #val
    out[#out + 1] = ids[i]
    out[#out + 1] = ids[i + 1]
    out[#out + 1] = val
  end
end
for i = 1, 3 do redis.call('EXPIRE', KEYS[i], ARGV[4]) end
return out`;

const PUSH = `
if redis.call('HGET', KEYS[1], 'ep') ~= ARGV[1] then return false end
local max = tonumber(ARGV[2])
local n = redis.call('HLEN', KEYS[2])
local out = {}
for i = 4, #ARGV, 5 do
  local id = ARGV[i]
  local exp = tonumber(ARGV[i + 1])
  local cur = redis.call('HGET', KEYS[2], id)
  local ver = 0
  if cur then ver = tonumber(string.match(cur, '^(%d+):')) end
  if ver ~= exp then
    out[#out + 1] = 0
    out[#out + 1] = ver
  elseif (not cur) and n >= max then
    out[#out + 1] = 2
    out[#out + 1] = 0
  else
    if not cur then n = n + 1 end
    local seq = redis.call('HINCRBY', KEYS[1], 'seq', 1)
    redis.call('HSET', KEYS[2], id, (ver + 1) .. ':' .. ARGV[i + 2] .. ':' .. ARGV[i + 3] .. ':' .. ARGV[i + 4])
    redis.call('ZADD', KEYS[3], seq, id)
    out[#out + 1] = 1
    out[#out + 1] = ver + 1
  end
end
for i = 1, 3 do redis.call('EXPIRE', KEYS[i], ARGV[3]) end
return out`;

const ROTATE = `
if redis.call('HGET', KEYS[1], 'ep') ~= ARGV[1] then return false end
local ep = redis.call('HINCRBY', KEYS[1], 'ep', 1)
redis.call('HSET', KEYS[1], 'salt', ARGV[2], 'th', ARGV[3])
redis.call('DEL', KEYS[2], KEYS[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return ep`;

const COUNT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;

export const SCRIPTS = { CREATE, PULL, PUSH, ROTATE, COUNT };

type Reply = string | number | null | Reply[];

const keys = (family: string) => [
  `nk:{${family}}:m`,
  `nk:{${family}}:r`,
  `nk:{${family}}:z`,
];

/** «ver:kind:iv:ct» → registro. */
function parseValue(
  id: string,
  seq: number,
  value: string,
): StoredRecord | null {
  const m = /^(\d+):(plan|item):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(value);
  if (!m) return null;
  return {
    id,
    seq,
    ver: Number(m[1]),
    kind: m[2] as "plan" | "item",
    iv: m[3],
    ct: m[4],
  };
}

export function createUpstashStore(
  url: string,
  token: string,
  fetcher: typeof fetch = fetch,
): FamilyStore {
  const base = url.replace(/\/+$/, "");

  async function call(command: (string | number)[]): Promise<Reply> {
    const res = await fetcher(base, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command.map(String)),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as {
      result?: Reply;
      error?: string;
    } | null;
    // El mensaje de la base no se propaga: puede repetir argumentos.
    if (!res.ok || !json || json.error !== undefined)
      throw new Error("family-store");
    return json.result ?? null;
  }

  const evalScript = (script: string, k: string[], args: (string | number)[]) =>
    call(["EVAL", script, k.length, ...k, ...args]);

  return {
    label: "real",
    async create(family, salt, tokenHash, ttl) {
      return (
        (await evalScript(
          CREATE,
          [keys(family)[0]],
          [salt, tokenHash, ttl],
        )) === 1
      );
    },
    async meta(family) {
      const r = await call(["HMGET", keys(family)[0], "salt", "th", "ep"]);
      if (
        !Array.isArray(r) ||
        typeof r[0] !== "string" ||
        typeof r[1] !== "string"
      )
        return null;
      return { salt: r[0], tokenHash: r[1], epoch: Number(r[2]) };
    },
    async pull(family, epoch, since, maxBytes, ttl): Promise<PullPage | null> {
      const r = await evalScript(PULL, keys(family), [
        epoch,
        since,
        maxBytes,
        ttl,
      ]);
      if (!Array.isArray(r)) return null;
      const records: StoredRecord[] = [];
      for (let i = 2; i + 2 < r.length; i += 3) {
        const rec = parseValue(
          String(r[i]),
          Number(r[i + 1]),
          String(r[i + 2]),
        );
        if (rec) records.push(rec);
      }
      return { seq: Number(r[0] ?? 0), more: Number(r[1]) === 1, records };
    },
    async push(
      family,
      epoch,
      items: PushItem[],
      maxRecords,
      ttl,
    ): Promise<PushOutcome[] | null> {
      const args: (string | number)[] = [epoch, maxRecords, ttl];
      for (const it of items) args.push(it.id, it.ver, it.kind, it.iv, it.ct);
      const r = await evalScript(PUSH, keys(family), args);
      if (!Array.isArray(r)) return null;
      const out: PushOutcome[] = [];
      for (let i = 0; i < r.length; i += 2) {
        const code = Number(r[i]);
        out.push({
          status: code === 1 ? "ok" : code === 2 ? "full" : "conflict",
          ver: Number(r[i + 1]),
        });
      }
      return out;
    },
    async rotate(family, epoch, salt, tokenHash, ttl) {
      const r = await evalScript(ROTATE, keys(family), [
        epoch,
        salt,
        tokenHash,
        ttl,
      ]);
      return typeof r === "number" ? r : null;
    },
    async destroy(family) {
      await call(["DEL", ...keys(family)]);
    },
    async count(key, windowSeconds) {
      return Number(await evalScript(COUNT, [`nk:c:${key}`], [windowSeconds]));
    },
  };
}
