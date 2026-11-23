import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  configure,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DietProvider } from "@/components/diet-provider";
import { PushSection } from "@/components/push/push-section";
import { PushSync } from "@/components/push/push-sync";
import SettingsPage from "@/app/ajustes/page";
import { I18nProvider } from "@/i18n";
import { tokenHash } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import { getPush } from "@/lib/push/controller";
import { readKey } from "@/lib/push/copy";
import { createMemoryPushStore } from "@/lib/push/server/memory";
import { handlePush } from "@/lib/push/server/handler";
import { generateVapidKeys, importVapid } from "@/lib/push/vapid";

configure({ asyncUtilTimeout: 6000 });

const EP = "https://fcm.googleapis.com/fcm/send/ui-1";
type Server = {
  store: ReturnType<typeof createMemoryPushStore>;
  available: boolean;
};
let server: Server;
let vapid: Awaited<ReturnType<typeof importVapid>>;
let permission: NotificationPermission;
let askResult: NotificationPermission;
let requestPermission: ReturnType<typeof vi.fn>;
let unsubscribed: number;

function installBrowser(
  opts: { serviceWorker?: boolean; push?: boolean } = {},
) {
  let current: {
    endpoint: string;
    unsubscribe: () => Promise<boolean>;
  } | null = null;
  const sub = {
    endpoint: EP,
    unsubscribe: async () => {
      unsubscribed++;
      current = null;
      return true;
    },
  };
  const reg = {
    pushManager: {
      subscribe: vi.fn(async () => (current = sub)),
      getSubscription: vi.fn(async () => current),
    },
  };
  if (opts.serviceWorker !== false)
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve(reg) },
      configurable: true,
    });
  else
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
    });
  if (opts.push !== false) vi.stubGlobal("PushManager", class {});
  else vi.stubGlobal("PushManager", undefined);
  requestPermission = vi.fn(async () => {
    permission = askResult;
    return permission;
  });
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission,
  });
  if (opts.push === false)
    delete (window as { PushManager?: unknown }).PushManager;
  return reg;
}

beforeEach(async () => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  localStorage.clear();
  permission = "default";
  askResult = "granted";
  unsubscribed = 0;
  const pair = await generateVapidKeys();
  vapid = await importVapid(
    pair.publicKey,
    pair.privateKey,
    "mailto:avisos@example.org",
  );
  const family = createMemoryStore({ isolated: true });
  await family.create(
    "A1B2C3D4E5",
    "s".repeat(22),
    tokenHash("F".repeat(43)),
    99,
  );
  server = {
    store: createMemoryPushStore({ isolated: true }),
    available: true,
  };
  let ip = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const out = await handlePush(
        {
          op: String(url).replace("/api/push/", ""),
          method: "POST",
          body: String(init.body ?? ""),
          authorization: headers.authorization ?? null,
          signature: null,
          ip: `10.2.0.${ip++ % 250}`,
        },
        {
          store: server.available ? server.store : null,
          family,
          vapid: server.available ? vapid : null,
          signingKeys: [],
          sender: async () => 201,
        },
      );
      return new Response(JSON.stringify(out.json), { status: out.status });
    }),
  );
  installBrowser();
});
afterEach(async () => {
  await getPush().disable();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "userAgent", {
    value: "Mozilla/5.0 (linux) jsdom",
    configurable: true,
  });
});

function renderSection() {
  return render(
    <I18nProvider>
      <DietProvider>
        <PushSync />
        <PushSection />
      </DietProvider>
    </I18nProvider>,
  );
}

describe("Ajustes · Avisos en este teléfono", () => {
  it("explica antes de pedir, no pide permiso al abrir, y lo pide una sola vez al tocar el botón", async () => {
    const user = userEvent.setup();
    renderSection();
    const button = await screen.findByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByText(/Las horas salen de tu plan/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nunca van nombres, alimentos, suplementos ni notas/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Solo te lo pide esta vez/)).toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled(); // abrir Ajustes no hace ninguna llamada

    await user.click(button);
    expect(
      await screen.findByText("✓ Avisos activos en este teléfono"),
    ).toBeInTheDocument();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(await server.store.all()).toHaveLength(1);
    // Los cuatro tipos, prendidos, y el detalle visible (apagado el interruptor).
    for (const name of [
      /Suplementos/,
      /Comidas y meriendas/,
      /^Agua/,
      /Avisos de la familia/,
    ])
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Ocultar el detalle/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Dejar de recibir avisos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Activar avisos en este teléfono" }),
    ).toBeNull();
  });

  it("cada tipo se prende y apaga por teléfono, y «ocultar el detalle» queda en la copia del teléfono", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      await screen.findByRole("button", {
        name: "Activar avisos en este teléfono",
      }),
    );
    await screen.findByText("✓ Avisos activos en este teléfono");
    const before = (await server.store.all())[0].wakes.length;

    await user.click(screen.getByRole("checkbox", { name: /^Agua/ }));
    await waitFor(
      async () =>
        expect((await server.store.all())[0].wakes.length).toBeLessThan(before),
      { timeout: 4000 },
    );
    expect(screen.getByRole("checkbox", { name: /^Agua/ })).not.toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: /Ocultar el detalle/ }),
    );
    await waitFor(
      async () =>
        expect(((await readKey("copy")) as { hide: boolean }).hide).toBe(true),
      { timeout: 4000 },
    );
    expect(
      screen.getByRole("checkbox", { name: /Ocultar el detalle/ }),
    ).toBeChecked();
    const copy = (await readKey("copy")) as { types: { water: boolean } };
    expect(copy.types.water).toBe(false);
  });

  it("«Dejar de recibir avisos» borra la suscripción y la copia, y vuelve a ofrecer activar", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(
      await screen.findByRole("button", {
        name: "Activar avisos en este teléfono",
      }),
    );
    await screen.findByText("✓ Avisos activos en este teléfono");
    expect(await readKey("copy")).toBeDefined();

    await user.click(
      screen.getByRole("button", { name: "Dejar de recibir avisos" }),
    );
    expect(
      await screen.findByText(/su dirección se borró del servidor/),
    ).toBeInTheDocument();
    expect(await server.store.all()).toEqual([]);
    expect(unsubscribed).toBe(1);
    expect(await readKey("copy")).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Activar avisos en este teléfono" }),
    ).toBeInTheDocument();
  });

  it("iPhone sin la app instalada: cómo instalarla, y ningún botón que pida permiso", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      configurable: true,
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    renderSection();
    const card = await screen.findByTestId("push-install");
    expect(
      within(card).getByText("Primero instala la app en tu iPhone"),
    ).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem")).toHaveLength(4);
    expect(
      within(card).getByText(/Añadir a pantalla de inicio/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Activar avisos/ })).toBeNull();
  });

  it("navegador sin avisos, permiso bloqueado y servicio sin llaves: cada uno lo dice y la app sigue", async () => {
    installBrowser({ push: false });
    const first = renderSection();
    expect(
      await screen.findByText(/Este navegador no puede mostrar avisos/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Activar avisos/ })).toBeNull();
    first.unmount();

    installBrowser();
    permission = "denied";
    const second = renderSection();
    expect(
      await screen.findByText(/El permiso está bloqueado/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Activar avisos/ })).toBeNull();
    second.unmount();

    permission = "default";
    server.available = false;
    const user = userEvent.setup();
    renderSection();
    const button = await screen.findByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByText(/no están disponibles en este servicio/),
    ).toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("si cierra el diálogo del permiso, dice que no se activó nada y deja volver a intentar", async () => {
    askResult = "default";
    const user = userEvent.setup();
    renderSection();
    const button = await screen.findByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No diste el permiso/,
    );
    expect(
      screen.getByRole("button", { name: "Activar avisos en este teléfono" }),
    ).toBeEnabled();
  });
});

describe("Ajustes · «Borrar datos» también deja de recibir avisos", () => {
  it("borra la suscripción del servidor y la copia del trabajador", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <DietProvider>
          <PushSync />
          <SettingsPage />
        </DietProvider>
      </I18nProvider>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Activar avisos en este teléfono",
      }),
    );
    await screen.findByText("✓ Avisos activos en este teléfono");
    expect(await server.store.all()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Borrar mis datos" }));
    await user.click(await screen.findByRole("button", { name: "Sí, borrar" }));
    await screen.findByText(/Datos borrados/);
    expect(await server.store.all()).toEqual([]);
    expect(await readKey("copy")).toBeUndefined();
    expect(localStorage.getItem("nutrikids.push.v1")).toBeNull();
  });
});
