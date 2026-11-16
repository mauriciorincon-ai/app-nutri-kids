/**
 * Avisos que llegan (S8 · ADR-012) — el lado del trabajador. `build-sw.mjs` lo inserta en
 * `public/sw.js`; las pruebas lo cargan tal cual (contrato con `src/lib/push/copy.ts` y con
 * el cifrado de `src/lib/family/crypto.ts`, regla 19).
 *
 * El toque llega VACÍO. El trabajador decide qué mostrar con lo que hay en el teléfono:
 *  1. ¿Venció un despertar del plan en los últimos 15 min que aún no se mostró? Arma el
 *     aviso con la copia local (o el genérico si «ocultar el detalle» está prendido). Si
 *     todo lo de esa hora ya está marcado, un aviso silencioso lo dice (iPhone exige
 *     mostrar algo en cada toque) — salvo que haya una nota nueva de la familia: esa gana.
 *  2. Si no, es un aviso de la familia: baja lo nuevo, lo descifra AQUÍ con las llaves no
 *     exportables del teléfono y muestra «Aviso de <nombre>». Si no puede, «Hay un aviso nuevo».
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NK_PUSH = (() => {
  const PUSH_DB = "nutrikids-push";
  const KV = "kv";
  const FAMILY_DB = "nutrikids-family";
  const KEYS = "keys";
  const SHOW_WINDOW_MIN = 15;
  const NOTICE_MAX = 140;
  const NAME_MAX = 30;
  const te = new TextEncoder();
  const td = new TextDecoder();

  /** Lee una clave sin crear la base si no existe (un teléfono sin copia no inventa una). */
  function idbGet(dbName, store, key) {
    return new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(dbName);
      } catch {
        resolve(undefined);
        return;
      }
      req.onupgradeneeded = () => req.transaction.abort();
      req.onerror = () => resolve(undefined);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const get = db.transaction(store).objectStore(store).get(key);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => {
            db.close();
            resolve(undefined);
          };
        } catch {
          db.close();
          resolve(undefined);
        }
      };
    });
  }

  function idbPut(key, value) {
    return new Promise((resolve) => {
      const req = indexedDB.open(PUSH_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(KV);
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(KV, "readwrite");
        tx.objectStore(KV).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          resolve(false);
        };
      };
    });
  }

  function fromB64u(s) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64u(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function localNow(date) {
    const p = (n) => String(n).padStart(2, "0");
    return {
      date: `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`,
      dow: date.getDay(),
      minute: date.getHours() * 60 + date.getMinutes(),
    };
  }

  /** El despertar más reciente de los últimos 15 min que aún no se mostró. */
  function pickWake(copy, now, shownKeys) {
    if (!copy || !Array.isArray(copy.items)) return null;
    const minutes = new Set();
    for (const it of copy.items) {
      if (
        Array.isArray(it.days) &&
        it.days.includes(now.dow) &&
        it.minute <= now.minute &&
        it.minute > now.minute - SHOW_WINDOW_MIN
      )
        minutes.add(it.minute);
    }
    const sorted = [...minutes].sort((a, b) => b - a);
    const minute = sorted.find((m) => !shownKeys.includes(`${now.date}|${m}`));
    if (minute === undefined) return null;
    const done =
      copy.done && copy.done.date === now.date ? copy.done.ids || [] : [];
    const due = copy.items.filter(
      (it) => it.minute === minute && it.days.includes(now.dow),
    );
    const pending = due.filter((it) => !done.includes(it.id));
    return { minute, key: `${now.date}|${minute}`, pending };
  }

  function scheduleNotice(copy, wake) {
    const base = { tag: "nk-plan", data: { url: "/" } };
    if (wake.pending.length === 0)
      return {
        title: copy.text.allDone.title,
        options: { ...base, body: copy.text.allDone.body, silent: true },
      };
    if (copy.hide)
      return {
        title: copy.text.hidden.title,
        options: { ...base, body: copy.text.hidden.body },
      };
    if (wake.pending.length === 1) {
      const it = wake.pending[0];
      return { title: it.title, options: { ...base, body: it.body } };
    }
    return {
      title: copy.text.many,
      options: {
        ...base,
        body: wake.pending.map((it) => it.title).join(" · "),
      },
    };
  }

  /** Abre un registro de la familia: AES-GCM con su AAD y el nombre que corresponde al id. */
  async function openRecord(keys, family, epoch, rec) {
    try {
      const plain = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromB64u(rec.iv),
          additionalData: te.encode(`nk1|${family}|${epoch}|${rec.id}`),
        },
        keys.enc,
        fromB64u(rec.ct),
      );
      const env = JSON.parse(td.decode(plain));
      if (!env || typeof env.n !== "string") return null;
      const mac = await crypto.subtle.sign("HMAC", keys.id, te.encode(env.n));
      if (toB64u(new Uint8Array(mac).slice(0, 16)) !== rec.id) return null;
      return env;
    } catch {
      return null;
    }
  }

  function validNotice(env, self) {
    if (!env || !env.n.startsWith("notice:")) return null;
    const d = env.d;
    if (!d || typeof d !== "object") return null;
    if (
      typeof d.text !== "string" ||
      !d.text.trim() ||
      d.text.length > NOTICE_MAX
    )
      return null;
    if (
      typeof d.name !== "string" ||
      !d.name.trim() ||
      d.name.length > NAME_MAX
    )
      return null;
    if (typeof d.t !== "number" || typeof d.by !== "string") return null;
    if (d.by === self) return null;
    return { text: d.text.trim(), name: d.name.trim(), t: d.t };
  }

  /**
   * Lo nuevo de la familia: { notice } con el más reciente no visto, «unreadable» si hubo
   * algo que no se pudo abrir (o no hay llaves), o null si no hay nada nuevo.
   */
  async function familyNotice(fetchFn) {
    const ptr = await idbGet(PUSH_DB, KV, "family");
    if (!ptr || typeof ptr.family !== "string") return "unreadable";
    const row = await idbGet(FAMILY_DB, KEYS, "main");
    if (!row || row.family !== ptr.family) return "unreadable";
    let token;
    try {
      const plain = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromB64u(row.token.iv),
          additionalData: te.encode(`nk1|token|${ptr.family}`),
        },
        row.enc,
        fromB64u(row.token.ct),
      );
      token = JSON.parse(td.decode(plain));
    } catch {
      return "unreadable";
    }
    if (typeof token !== "string") return "unreadable";
    const seen = Number((await idbGet(PUSH_DB, KV, "familySeen")) || 0);
    let res;
    try {
      res = await fetchFn("/api/family/pull", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          family: ptr.family,
          epoch: ptr.epoch,
          since: ptr.seq,
        }),
        cache: "no-store",
      });
    } catch {
      return "unreadable";
    }
    if (!res.ok) return "unreadable";
    const page = await res.json().catch(() => null);
    if (!page || !Array.isArray(page.records)) return "unreadable";
    let best = null;
    for (const rec of page.records) {
      const env = await openRecord(row, ptr.family, ptr.epoch, rec);
      const notice = validNotice(env, ptr.self);
      if (notice && notice.t > seen && (!best || notice.t > best.t))
        best = notice;
    }
    if (!best) return null;
    await idbPut("familySeen", best.t);
    return { notice: best };
  }

  function familyShown(copy, found) {
    const base = { tag: "nk-family", data: { url: "/#avisos" } };
    if (found && found.notice && !copy.hide)
      return {
        title: copy.text.familyFrom.replace("{name}", found.notice.name),
        options: { ...base, body: found.notice.text },
      };
    return {
      title: copy.text.familyGeneric.title,
      options: { ...base, body: copy.text.familyGeneric.body },
    };
  }

  const FALLBACK = {
    title: "Nutrikids",
    options: { tag: "nk-plan", data: { url: "/" } },
  };

  /** Qué mostrar ante un toque. Siempre devuelve algo (iPhone lo exige). */
  async function onPush(date, fetchFn) {
    const copy = await idbGet(PUSH_DB, KV, "copy");
    if (!copy || copy.v !== 1 || !copy.text) return FALLBACK;
    const now = localNow(date);
    const shown = (await idbGet(PUSH_DB, KV, "shown")) || {};
    const keys = shown.date === now.date ? shown.keys || [] : [];
    const wake = pickWake(copy, now, keys);
    if (wake) {
      await idbPut("shown", { date: now.date, keys: [...keys, wake.key] });
      // Un despertar ya marcado (silencioso) no puede tragarse un aviso de la familia que
      // llegó en la misma ventana: si hay una nota nueva, esa es la que se muestra.
      if (wake.pending.length === 0 && copy.types && copy.types.family) {
        const found = await familyNotice(fetchFn);
        if (found && found.notice) return familyShown(copy, found);
      }
      return scheduleNotice(copy, wake);
    }
    if (copy.types && copy.types.family) {
      const found = await familyNotice(fetchFn);
      return familyShown(copy, found);
    }
    return {
      title: copy.text.generic.title,
      options: { ...FALLBACK.options, body: copy.text.generic.body },
    };
  }

  /** Solo rutas de la propia app: un aviso jamás abre otro sitio. */
  function clickUrl(data) {
    const url = data && typeof data.url === "string" ? data.url : "/";
    // Solo «/ruta»: ni «//otro» ni «/\\otro» (el navegador trata la barra invertida como «/»).
    return /^\/(?![\\/])/.test(url) ? url : "/";
  }

  return {
    localNow,
    pickWake,
    scheduleNotice,
    openRecord,
    familyNotice,
    onPush,
    clickUrl,
  };
})();
