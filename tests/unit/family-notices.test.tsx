import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  act,
  configure,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FamilyNotices } from "@/components/notices/family-notices";
import { I18nProvider } from "@/i18n";
import { clearDevice } from "@/lib/device";
import { dateKey } from "@/lib/diet/logic";
import { getFamily } from "@/lib/family/controller";
import {
  NOTICES_KEY,
  clearNotices,
  newNoticeId,
  putNotice,
  readNotices,
  noticeRecords,
} from "@/lib/family/notices";
import {
  NOTICE_TEXT_MAX,
  noticeName,
  openNamed,
  parseNamed,
  sealNamed,
} from "@/lib/family/records";
import { deriveKeys, newSalt } from "@/lib/family/crypto";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import { notifyLocalStore } from "@/lib/local-store";

configure({ asyncUtilTimeout: 6000 });

const TODAY = "2026-11-16";
const note = (over: Record<string, unknown> = {}) => ({
  text: "Ya va para la escuela",
  name: "Mamá",
  by: "PHONEAAAAAAA",
  t: 1_000,
  date: TODAY,
  ...over,
});

describe("el aviso como registro cifrado", () => {
  it("valida su forma y descarta lo que no encaja", () => {
    const ok = parseNamed({ n: noticeName("abc123def456"), d: note() });
    expect(ok?.name).toBe("notice:abc123def456");
    for (const bad of [
      note({ text: "" }),
      note({ text: "x".repeat(NOTICE_TEXT_MAX + 1) }),
      note({ name: "  " }),
      note({ name: "n".repeat(31) }),
      note({ date: "16-11-2026" }),
      note({ t: -1 }),
      note({ by: "" }),
    ])
      expect(parseNamed({ n: noticeName("abc123def456"), d: bad })).toBeNull();
    // Un id de aviso que no es del formato no pasa (ni «notice:» vacío).
    expect(parseNamed({ n: "notice:", d: note() })).toBeNull();
    expect(parseNamed({ n: "notice:../x", d: note() })).toBeNull();
  });

  it("se sella y se abre; el servidor solo ve «item», un id opaco y bytes", async () => {
    const keys = await deriveKeys("frase de prueba", newSalt());
    const named = {
      name: noticeName("abc123def456"),
      data: note({ text: "SENTINEL-NOTICE" }),
    } as const;
    const wire = await sealNamed(keys, "FAMILY0001", 1, named);
    expect(wire.kind).toBe("item");
    expect(JSON.stringify(wire)).not.toMatch(/SENTINEL|notice|Mamá/);
    expect(await openNamed(keys, "FAMILY0001", 1, wire)).toEqual(named);
  });
});

describe("los avisos de este teléfono", () => {
  beforeEach(() => localStorage.clear());

  it("guarda lo de hoy y ayer, lo más nuevo primero; lo viejo se suelta", () => {
    expect(putNotice("aaaaaaaaaaaa", note({ t: 1 }), TODAY)).toBe(true);
    expect(
      putNotice("bbbbbbbbbbbb", note({ t: 2, date: "2026-11-15" }), TODAY),
    ).toBe(true);
    expect(
      putNotice("cccccccccccc", note({ t: 3, date: "2026-11-14" }), TODAY),
    ).toBe(false);
    expect(readNotices(TODAY).map((n) => n.id)).toEqual([
      "bbbbbbbbbbbb",
      "aaaaaaaaaaaa",
    ]);
    // Al día siguiente, el de anteayer se va y el de ayer queda.
    expect(
      putNotice(
        "dddddddddddd",
        note({ t: 4, date: "2026-11-17" }),
        "2026-11-17",
      ),
    ).toBe(true);
    expect(readNotices("2026-11-17").map((n) => n.id)).toEqual([
      "dddddddddddd",
      "aaaaaaaaaaaa",
    ]);
    expect(Object.keys(noticeRecords("2026-11-17")).sort()).toEqual([
      "aaaaaaaaaaaa",
      "dddddddddddd",
    ]);
  });

  it("«ayer» respeta el cambio de mes y de año", () => {
    putNotice("aaaaaaaaaaaa", note({ date: "2026-11-30" }), "2026-12-01");
    expect(readNotices("2026-12-01")).toHaveLength(1);
    localStorage.clear();
    putNotice("bbbbbbbbbbbb", note({ date: "2026-12-31" }), "2027-01-01");
    expect(readNotices("2027-01-01")).toHaveLength(1);
  });

  it("no repite un aviso que ya tiene, ni acepta un id mal formado", () => {
    expect(putNotice("aaaaaaaaaaaa", note(), TODAY)).toBe(true);
    expect(putNotice("aaaaaaaaaaaa", note({ text: "otro" }), TODAY)).toBe(
      false,
    );
    expect(putNotice("../etc", note(), TODAY)).toBe(false);
    expect(readNotices(TODAY)[0].text).toBe("Ya va para la escuela");
  });

  it("lo guardado dañado o que no valida se ignora sin romper", () => {
    localStorage.setItem(NOTICES_KEY, "no es json");
    expect(readNotices(TODAY)).toEqual([]);
    localStorage.setItem(
      NOTICES_KEY,
      JSON.stringify({ aaaaaaaaaaaa: { text: 1 }, "x/y": note() }),
    );
    expect(readNotices(TODAY)).toEqual([]);
  });

  it("clearNotices lo borra y los ids nuevos son de 12 caracteres 0-9 a-z", () => {
    putNotice("aaaaaaaaaaaa", note(), TODAY);
    clearNotices();
    expect(localStorage.getItem(NOTICES_KEY)).toBeNull();
    expect(newNoticeId()).toMatch(/^[0-9a-z]{12}$/);
    expect(newNoticeId()).not.toBe(newNoticeId());
  });
});

type Net = { offline: boolean; touched: string[] };
const net: Net = { offline: false, touched: [] };

function stubNetwork() {
  const store = createMemoryStore({ isolated: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (net.offline) throw new TypeError("Failed to fetch");
      const headers = (init.headers ?? {}) as Record<string, string>;
      if (String(url).startsWith("/api/push/")) {
        net.touched.push(`${url} ${String(init.body)}`);
        return new Response(JSON.stringify({ sent: 1 }), { status: 200 });
      }
      const out = await handle(
        {
          op: String(url).replace("/api/family/", ""),
          method: "POST",
          body: String(init.body ?? ""),
          authorization: headers.authorization ?? null,
          ip: "203.0.113.8",
        },
        store,
      );
      return new Response(JSON.stringify(out.json), { status: out.status });
    }),
  );
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  localStorage.clear();
  net.offline = false;
  net.touched = [];
  stubNetwork();
});
afterEach(async () => {
  await getFamily().leave();
  clearDevice();
  vi.unstubAllGlobals();
});

describe("«Avisar a la familia» en el director", () => {
  it("sin familia: «no-family»; con familia sube el aviso y despierta a los demás una sola vez", async () => {
    const f = getFamily();
    expect(await f.sendNotice("hola")).toEqual({
      ok: false,
      reason: "no-family",
    });
    const created = await f.create("Mamá");
    expect(created.ok).toBe(true);

    const r = await f.sendNotice("  Ya salimos  ");
    expect(r).toEqual({ ok: true, queued: false });
    const mine = readNotices(dateKey(new Date()));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ text: "Ya salimos", name: "Mamá" });
    // Solo se despierta con el código de la familia; el texto no sale en claro.
    expect(net.touched).toHaveLength(1);
    expect(net.touched[0]).toContain("/api/push/family");
    expect(net.touched[0]).not.toContain("Ya salimos");
    expect(net.touched[0]).not.toContain("Mamá");

    // Una pasada más no despierta otra vez.
    await f.sync();
    expect(net.touched).toHaveLength(1);
  });

  it("vacío o demasiado largo no se envía; sin red queda guardado y despierta al volver", async () => {
    const f = getFamily();
    await f.create("Mamá");
    expect(await f.sendNotice("   ")).toEqual({ ok: false, reason: "error" });
    expect(await f.sendNotice("x".repeat(NOTICE_TEXT_MAX + 1))).toEqual({
      ok: false,
      reason: "error",
    });
    expect(readNotices(dateKey(new Date()))).toHaveLength(0);

    net.offline = true;
    expect(await f.sendNotice("sin red")).toEqual({ ok: true, queued: true });
    expect(net.touched).toHaveLength(0);
    net.offline = false;
    await f.sync();
    expect(net.touched).toHaveLength(1);
  });
});

function renderNotices() {
  return render(
    <I18nProvider>
      <FamilyNotices today={new Date()} />
    </I18nProvider>,
  );
}

describe("Hoy: avisos de la familia", () => {
  it("sin familia no se pinta nada", () => {
    const { container } = renderNotices();
    expect(container).toBeEmptyDOMElement();
  });

  it("con familia: escribe un aviso, aparece con «Por ti», y uno de otro teléfono dice quién", async () => {
    const user = userEvent.setup();
    await getFamily().create("Mamá");
    renderNotices();
    const section = await screen.findByTestId("family-notices");
    expect(section).toHaveAttribute("id", "avisos");
    expect(screen.getByText("Hoy no hay avisos.")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Avisar a la familia" }),
    );
    expect(screen.getByText("0 de 140")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(
      await screen.findByText(/Escribe algo antes de enviar/),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Tu aviso"), "Ya comió");
    expect(screen.getByText("8 de 140")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(await screen.findByText("✓ Aviso enviado.")).toBeInTheDocument();
    const items = await screen.findAllByTestId("notice");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Ya comió");
    expect(items[0]).toHaveTextContent("Por ti");

    act(() => {
      putNotice(
        "zzzzzzzzzzzz",
        note({
          text: "Llegó la abuela",
          name: "Abuela",
          by: "OTHERPHONE01",
          t: Date.now() + 5,
          date: dateKey(new Date()),
        }),
        dateKey(new Date()),
      );
      notifyLocalStore();
    });
    await waitFor(() =>
      expect(screen.getAllByTestId("notice")).toHaveLength(2),
    );
    expect(screen.getAllByTestId("notice")[0]).toHaveTextContent(
      "Llegó la abuela",
    );
    expect(screen.getAllByTestId("notice")[0]).toHaveTextContent("Por Abuela");
  });

  it("cancelar cierra el cuadro y borra lo escrito; sin red lo dice llano", async () => {
    const user = userEvent.setup();
    await getFamily().create("Mamá");
    renderNotices();
    await user.click(
      await screen.findByRole("button", { name: "Avisar a la familia" }),
    );
    await user.type(screen.getByLabelText("Tu aviso"), "algo");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Tu aviso")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Avisar a la familia" }),
    );
    expect(screen.getByLabelText("Tu aviso")).toHaveValue("");

    net.offline = true;
    await user.type(screen.getByLabelText("Tu aviso"), "sin red");
    await user.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(
      await screen.findByText(/Se envía cuando vuelva la red/),
    ).toBeInTheDocument();
  });
});
