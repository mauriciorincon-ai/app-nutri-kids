import { NOTICE_ID, noticeSchema, type NoticeShared } from "./records";

/**
 * Los avisos de la familia en ESTE teléfono (S8 · ADR-012): los que escribió y los que llegaron,
 * en `localStorage`, solo los de hoy y ayer (un aviso es del momento; lo viejo se suelta solo).
 * Nada de esto es del niño, pero lleva el nombre de quien cuida: jamás sale en claro.
 */

export const NOTICES_KEY = "nutrikids.notices.v1";

export type Notice = NoticeShared & { id: string };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD de hace `back` días respecto a `today`, sin husos: se hace sobre el calendario. */
function daysBack(today: string, back: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - back));
  return dt.toISOString().slice(0, 10);
}

function read(): Record<string, NoticeShared> {
  try {
    const raw = storage()?.getItem(NOTICES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, NoticeShared> = {};
    for (const [id, v] of Object.entries(parsed)) {
      const r = noticeSchema.safeParse(v);
      if (r.success && NOTICE_ID.test(id)) out[id] = r.data;
    }
    return out;
  } catch {
    return {};
  }
}

function write(all: Record<string, NoticeShared>): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(NOTICES_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** Los avisos de hoy y ayer, el más nuevo primero. */
export function readNotices(today: string): Notice[] {
  const keep = new Set([today, daysBack(today, 1)]);
  return Object.entries(read())
    .filter(([, n]) => keep.has(n.date))
    .map(([id, n]) => ({ id, ...n }))
    .sort((a, b) => b.t - a.t);
}

/** Lo que de verdad viaja: los de hoy y ayer, por id. */
export function noticeRecords(today: string): Record<string, NoticeShared> {
  return Object.fromEntries(readNotices(today).map(({ id, ...n }) => [id, n]));
}

/** Suma un aviso (propio o que llegó). Devuelve true si es nuevo aquí. */
export function putNotice(
  id: string,
  notice: NoticeShared,
  today: string,
): boolean {
  if (!NOTICE_ID.test(id)) return false;
  const all = read();
  if (all[id]) return false;
  const keep = new Set([today, daysBack(today, 1)]);
  if (!keep.has(notice.date)) return false;
  all[id] = notice;
  for (const [k, n] of Object.entries(all))
    if (!keep.has(n.date)) delete all[k];
  return write(all);
}

export function clearNotices(): void {
  try {
    storage()?.removeItem(NOTICES_KEY);
  } catch {
    /* nada */
  }
}

/** Id de un aviso: 12 caracteres al azar (0-9, a-z). */
export function newNoticeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}
