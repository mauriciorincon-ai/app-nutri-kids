import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { axe } from "./phones";

import { signLikeQstash } from "../../src/lib/push/qstash";

/**
 * Avisos que llegan (S8 · ADR-012) contra el doble del almacén y llaves de PRUEBA que nacen en
 * `playwright.config.ts`: jamás la base ni llaves reales.
 *
 *  · La suscripción del navegador es un doble (`PushManager`): el servicio de push real no
 *    entra. El toque lo entrega CDP (`ServiceWorker.deliverPushMessage`) al trabajador REAL de
 *    la compilación de producción, que arma el aviso con la copia local del teléfono.
 *  · El centinela: sobre cada petición a `/api/push` y `/api/family` (cuerpo y encabezados)
 *    nada de lo que toca ni el nombre del teléfono ni el texto de un aviso viaja en claro.
 *  · El trabajador solo existe en producción: lo que lo necesita corre en la CI (`CI=1`).
 */

const NOTE = "Sentinela quinoa 7391";
const MAMA = "Mamá";
const PAPA = "Papá";
const NEEDS_SW = "El service worker solo se registra en producción (CI=1)";

type Wire = string[];
type Phone = { context: BrowserContext; page: Page; wire: Wire };

let seq = 0;

/** Un teléfono: contexto propio, IP propia, permiso concedido y suscripción de mentira. */
type PhoneOptions = {
  /** El permiso ya está negado en el navegador. */
  denied?: boolean;
  /** Este navegador no sabe de push (sin PushManager). */
  noPush?: boolean;
  /** Un iPhone con la app sin instalar. */
  ios?: boolean;
  /** Hay una versión nueva de la app esperando turno. */
  updateWaiting?: boolean;
};

async function phone(
  browser: Browser,
  baseURL: string,
  opts: PhoneOptions = {},
): Promise<Phone> {
  seq += 1;
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const context = await browser.newContext({
    baseURL,
    ...(opts.ios
      ? {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        }
      : {}),
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${(seq + 100) % 250}.${octet()}.${octet()}`,
    },
  });
  await context.grantPermissions(["notifications"], { origin: baseURL });
  const wire: Wire = [];
  await context.route(/\/api\/(push|family)\//, (route) => {
    const req = route.request();
    wire.push(
      `${req.url()}\n${JSON.stringify(req.headers())}\n${req.postData() ?? ""}`,
    );
    return route.continue();
  });
  // En el contexto (no en la página): cada pestaña de este teléfono lleva el mismo doble.
  await context.addInitScript((o) => {
    const store = window.localStorage;
    if (!store.getItem("nutrikids.prefs.v1"))
      store.setItem(
        "nutrikids.prefs.v1",
        JSON.stringify({ locale: "es", disclaimerSeen: true }),
      );
    // El permiso se pide una vez, al tocar: el doble lo cuenta y lo concede.
    const asked = () => Number(store.getItem("e2e.asked") ?? 0);
    Object.defineProperty(Notification, "permission", {
      get: () => (o.denied ? "denied" : asked() > 0 ? "granted" : "default"),
    });
    if (o.noPush) {
      delete (window as unknown as { PushManager?: unknown }).PushManager;
      return;
    }
    if (o.updateWaiting)
      Object.defineProperty(navigator.serviceWorker, "getRegistration", {
        value: async () => ({ waiting: {} }),
      });
    Notification.requestPermission = async () => {
      store.setItem("e2e.asked", String(asked() + 1));
      return "granted";
    };
    // La suscripción: un doble que sobrevive a las recargas.
    const make = () => {
      const id = Math.random().toString(36).slice(2);
      return `https://fcm.googleapis.com/fcm/send/e2e-${id}`;
    };
    PushManager.prototype.subscribe = async function () {
      const endpoint = store.getItem("e2e.sub") ?? make();
      store.setItem("e2e.sub", endpoint);
      return {
        endpoint,
        unsubscribe: async () => true,
      } as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async function () {
      const endpoint = store.getItem("e2e.sub");
      return endpoint
        ? ({
            endpoint,
            unsubscribe: async () => {
              store.removeItem("e2e.sub");
              return true;
            },
          } as unknown as PushSubscription)
        : null;
    };
  }, opts);
  const page = await context.newPage();
  return { context, page, wire };
}

async function enable(page: Page) {
  await page.goto("/ajustes");
  const button = page.getByRole("button", {
    name: "Activar avisos en este teléfono",
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText("✓ Avisos activos en este teléfono")).toBeVisible(
    { timeout: 15_000 },
  );
}

type Stored = {
  hide: boolean;
  items: { id: string; minute: number; title: string; body: string }[];
  done: { date: string; ids: string[] };
};

/** Lee o reescribe la copia local (la que lee el trabajador) y borra lo ya mostrado. */
async function editCopy(
  page: Page,
  mode: "read" | "now-one" | "now-one-done" | "none" | "reset",
): Promise<Stored> {
  return page.evaluate(async (m) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("nutrikids-push", 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("kv", "readwrite");
    const kv = tx.objectStore("kv");
    const copy = await new Promise<Stored>((res) => {
      const g = kv.get("copy");
      g.onsuccess = () => res(g.result);
    });
    if (m === "reset") {
      // Solo olvida lo «ya mostrado» y lo «ya visto» de la familia: el toque se puede repetir.
      kv.delete("shown");
      kv.delete("familySeen");
    } else if (m !== "read") {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      const p = (n: number) => String(n).padStart(2, "0");
      const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
      const first = copy.items[0];
      copy.items =
        m === "none"
          ? []
          : [{ ...first, minute, days: [0, 1, 2, 3, 4, 5, 6] } as never];
      copy.done = { date, ids: m === "now-one-done" ? [first.id] : [] };
      kv.put(copy, "copy");
      kv.delete("shown");
    }
    await new Promise<void>((res) => {
      tx.oncomplete = () => res();
    });
    db.close();
    return copy;
  }, mode);
}

type Shown = {
  title: string;
  body: string;
  tag: string;
  silent: boolean | null;
  url: string;
};

/** Entrega un toque VACÍO al trabajador real y devuelve los avisos que mostró. */
async function deliverPush(
  page: Page,
  baseURL: string,
  edit?: Parameters<typeof editCopy>[1],
): Promise<Shown[]> {
  const cdp = await page.context().newCDPSession(page);
  const regs: string[] = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
    for (const r of e.registrations)
      if (r.scopeURL.startsWith(baseURL)) regs.push(r.registrationId);
  });
  const swErrors: string[] = [];
  cdp.on("ServiceWorker.workerErrorReported", (e) =>
    swErrors.push(e.errorMessage.errorMessage),
  );
  await cdp.send("ServiceWorker.enable");
  await expect.poll(() => regs.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const read = () =>
    page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.getNotifications()).map((n) => ({
        title: n.title,
        body: n.body,
        tag: n.tag,
        silent: n.silent,
        url: (n.data as { url?: string } | null)?.url ?? "",
      }));
    });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (const n of await reg.getNotifications()) n.close();
  });
  // Cerrar es asíncrono: se espera a que de verdad no quede ninguno antes de tocar.
  await expect.poll(async () => (await read()).length).toBe(0);
  // El dominio de CDP lista las suscripciones de todo el navegador (también las de pruebas
  // anteriores del mismo origen) y la de este teléfono puede llegar después: el toque va a cada
  // una apenas aparece; solo la de este teléfono tiene dueño.
  const touched = new Set<string>();
  const touchNew = async () => {
    for (const registrationId of new Set(regs)) {
      if (touched.has(registrationId)) continue;
      touched.add(registrationId);
      await cdp
        .send("ServiceWorker.deliverPushMessage", {
          origin: new URL(baseURL).origin,
          registrationId,
          data: "",
        })
        .catch(() => null);
    }
  };
  // Se guarda lo PRIMERO que aparece: si llegan dos toques con la misma etiqueta, el segundo
  // reemplaza al primero y por un instante no hay ninguno a la vista.
  let out: Shown[] = [];
  const ATTEMPTS = 3;
  for (let attempt = 1; attempt <= ATTEMPTS && out.length === 0; attempt++) {
    // La copia se ajusta JUSTO antes del toque: ninguna recarga de la página la pisa en medio.
    // (Un intento nuevo la vuelve a sembrar y borra lo «ya mostrado».)
    if (edit) await editCopy(page, edit);
    touched.clear();
    try {
      await expect
        .poll(
          async () => {
            await touchNew();
            const now = await read();
            if (now.length > 0 && out.length === 0) out = now;
            return out.length;
          },
          { timeout: 3_000 },
        )
        .toBeGreaterThan(0);
    } catch (e) {
      // El Chromium sin interfaz a veces descarta un aviso que el trabajador sí armó (lo anota
      // como mostrado y no hay error): es del entorno de prueba, así que se repite el toque.
      if (attempt === ATTEMPTS)
        throw new Error(
          `el trabajador no mostró nada en ${ATTEMPTS} intentos. Errores: ${swErrors.join(" | ") || "ninguno"}`,
          { cause: e },
        );
    }
  }
  await cdp.send("ServiceWorker.disable");
  await cdp.detach();
  return out;
}

const pushState = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("nutrikids.push.v1") ?? "null"),
  );

function noPlain(wire: Wire, forbidden: string[]) {
  expect(wire.length).toBeGreaterThan(0);
  for (const sent of wire)
    for (const word of forbidden.filter((w) => w.length > 3))
      expect(sent.toLowerCase()).not.toContain(word.toLowerCase());
}

// El «headless» nuevo: el viejo (headless shell) no deja a un service worker mostrar avisos.
test.use({ channel: "chromium" });

test.describe("avisos en este teléfono", () => {
  test.skip(!process.env.CI, NEEDS_SW);

  test("explica antes, pide el permiso al tocar (una vez) y el servidor solo ve horas sin etiqueta", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await a.page.goto("/ajustes");
    const section = a.page.getByTestId("push-section");
    await expect(section).toContainText("El aviso se arma en tu teléfono");
    await expect(section).toContainText("Solo te lo pide esta vez");
    expect(
      await a.page.evaluate(() => window.localStorage.getItem("e2e.asked")),
    ).toBeNull();
    expect(a.wire.filter((w) => w.includes("/api/push/subscribe"))).toEqual([]);
    await axe(a.page, "avisos · apagado");

    await enable(a.page);
    expect(
      await a.page.evaluate(() => window.localStorage.getItem("e2e.asked")),
    ).toBe("1");
    await expect(section.getByRole("checkbox")).toHaveCount(5);
    await expect(
      section.getByRole("checkbox", {
        name: /Ocultar el detalle con el teléfono bloqueado/,
      }),
    ).not.toBeChecked();
    await axe(a.page, "avisos · activos");

    const copy = await editCopy(a.page, "read");
    const labels = copy.items.flatMap((i) => [i.title, i.body]);
    expect(labels.length).toBeGreaterThan(0);
    const sub = a.wire.filter((w) => w.includes("/api/push/subscribe"));
    expect(sub).toHaveLength(1);
    const body = JSON.parse(sub[0].split("\n")[2]) as {
      endpoint: string;
      token: string;
      tz: string;
      wakes: { m: number; d: number }[];
      family: unknown;
    };
    expect(Object.keys(body).sort()).toEqual([
      "endpoint",
      "family",
      "token",
      "tz",
      "wakes",
    ]);
    for (const w of body.wakes)
      expect(Object.keys(w).sort()).toEqual(["d", "m"]);
    expect(body.family).toBeNull();
    // Ni un título ni un cuerpo del aviso salieron del teléfono.
    noPlain(a.wire, [...labels, "Desayuno", "Almuerzo", "Multivitam"]);

    // Apagar un tipo recorta las horas que el servidor guarda.
    const before = body.wakes.length;
    const upd = a.page.waitForRequest((r) =>
      r.url().endsWith("/api/push/update"),
    );
    await section.getByRole("checkbox", { name: /^Agua/ }).uncheck();
    const next = JSON.parse((await upd).postData() ?? "{}") as {
      wakes: unknown[];
    };
    expect(next.wakes.length).toBeLessThan(before);
    await a.context.close();
  });

  test("marcar antes de la hora le pide al servidor saltar ese aviso de hoy, y desmarcar lo devuelve", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    // Lunes 6:55: el primer despertar del plan es a las 7:00.
    await a.page.clock.install({ time: new Date("2026-07-06T06:55:00") });
    await enable(a.page);
    await a.page.goto("/");
    const boxes = a.page.getByRole("checkbox");
    await expect(boxes.first()).toBeVisible();
    const n = await boxes.count();
    expect(n).toBeGreaterThan(3);
    const skipOn = a.page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/push/skip") &&
        JSON.parse(r.postData() ?? "{}").on === true,
    );
    for (let i = 0; i < n; i++) await boxes.nth(i).click();
    const on = JSON.parse((await skipOn).postData() ?? "{}") as Record<
      string,
      unknown
    >;
    expect(Object.keys(on).sort()).toEqual(["date", "id", "m", "on"]);
    expect(on.date).toBe("2026-07-06");
    expect(on.m).toBe(420);

    const skipOff = a.page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/push/skip") &&
        JSON.parse(r.postData() ?? "{}").on === false,
    );
    await boxes.first().click();
    expect(JSON.parse((await skipOff).postData() ?? "{}").m).toBe(420);
    await a.context.close();
  });

  // Un toque por teléfono: dos avisos seguidos con la misma etiqueta en un mismo Chromium sin
  // interfaz son una carrera del entorno, no de la app.
  test("el teléfono bloqueado muestra el detalle de lo que toca (título y cuerpo del plan)", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await enable(a.page);
    const shown = await deliverPush(a.page, baseURL!, "now-one");
    const item = (await editCopy(a.page, "read")).items[0];
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe(item.title);
    expect(shown[0].body).toBe(item.body);
    expect(shown[0].silent).not.toBe(true);
    expect(shown[0].url).toBe("/");
    await a.context.close();
  });

  test("si todo lo de esa hora ya está marcado, un aviso silencioso lo dice", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await enable(a.page);
    const shown = await deliverPush(a.page, baseURL!, "now-one-done");
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Lo de esta hora ya está marcado");
    expect(shown[0].silent).toBe(true);
    await a.context.close();
  });

  test("«Ocultar el detalle»: el teléfono bloqueado dice solo «Nutrikids»", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await enable(a.page);
    const hide = a.page.getByTestId("push-section").getByRole("checkbox", {
      name: /Ocultar el detalle con el teléfono bloqueado/,
    });
    await hide.check();
    await expect
      .poll(async () => (await editCopy(a.page, "read")).hide)
      .toBe(true);
    const shown = await deliverPush(a.page, baseURL!, "now-one");
    const item = (await editCopy(a.page, "read")).items[0];
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Nutrikids");
    expect(shown[0].body).not.toContain(item.title);
    expect(shown[0].body).not.toContain(item.body);
    await axe(a.page, "avisos · ocultar el detalle");
    await a.context.close();
  });

  test("«Dejar de recibir avisos» borra la suscripción del servidor y del teléfono", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await enable(a.page);
    const st = await pushState(a.page);
    expect(st.token).toHaveLength(43);

    const gone = a.page.waitForResponse((r) =>
      r.url().endsWith("/api/push/unsubscribe"),
    );
    await a.page
      .getByRole("button", { name: "Dejar de recibir avisos" })
      .click();
    expect((await gone).status()).toBe(200);
    await expect(
      a.page.getByText(/Listo: este teléfono ya no recibe avisos/),
    ).toBeVisible();
    await axe(a.page, "avisos · dejar de recibir");
    expect(await pushState(a.page)).toBeNull();
    expect(
      await a.page.evaluate(() => window.localStorage.getItem("e2e.sub")),
    ).toBeNull();

    // Para el servidor ya no existe: su llave de escritura no abre nada.
    const res = await a.page.request.post("/api/push/update", {
      headers: { authorization: `Bearer ${st.token}` },
      data: {
        id: st.id,
        endpoint: "https://fcm.googleapis.com/fcm/send/x",
        tz: "UTC",
        wakes: [],
        family: null,
      },
    });
    expect(res.status()).toBe(403);
    await a.context.close();
  });

  test("«Borrar mis datos» también quita la suscripción", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await enable(a.page);
    const gone = a.page.waitForResponse((r) =>
      r.url().endsWith("/api/push/unsubscribe"),
    );
    await a.page.getByRole("button", { name: "Borrar mis datos" }).click();
    await a.page.getByRole("button", { name: "Sí, borrar" }).click();
    expect((await gone).status()).toBe(200);
    await expect(a.page.getByText("Datos borrados.")).toBeVisible();
    expect(await pushState(a.page)).toBeNull();
    await expect(
      a.page.getByRole("button", { name: "Activar avisos en este teléfono" }),
    ).toBeVisible();
    await a.context.close();
  });

  test("avisar a la familia: la nota viaja cifrada, despierta el otro teléfono y su toque abre Hoy con quién la escribió", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    const b = await phone(browser, baseURL!);

    // Mamá crea la familia.
    await a.page.goto("/ajustes");
    await a.page.getByTestId("family-create").click();
    await a.page.getByLabel(/Nombre de este teléfono/).fill(MAMA);
    await a.page
      .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
      .check();
    await a.page.getByRole("button", { name: "Crear la familia" }).click();
    await expect(a.page.getByTestId("family-secrets")).toBeVisible();
    const code = (await a.page.getByTestId("family-code").innerText()).trim();
    const phrase = (
      await a.page.getByTestId("family-phrase").innerText()
    ).trim();
    await a.page.getByRole("checkbox", { name: /Ya los anoté/ }).check();
    await a.page.getByRole("button", { name: "Listo" }).click();
    await expect(a.page.getByTestId("family-panel")).toBeVisible();

    // Papá entra y prende los avisos en su teléfono.
    await b.page.goto("/ajustes");
    await b.page.getByTestId("family-join").click();
    await b.page.getByLabel("Invitación", { exact: true }).fill(code);
    await b.page.getByLabel("Frase", { exact: true }).fill(phrase);
    await b.page.getByLabel(/Nombre de este teléfono/).fill(PAPA);
    await b.page
      .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
      .check();
    await b.page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(b.page.getByTestId("family-panel")).toBeVisible();
    await enable(b.page);
    await expect
      .poll(async () => (await pushState(b.page))?.sent !== undefined)
      .toBe(true);
    // Papá prueba su pertenencia con el token de la familia: el servidor guarda su código.
    await expect
      .poll(() =>
        b.wire.some((w) => {
          if (!/\/api\/push\/(subscribe|update)\n/.test(w)) return false;
          const body = JSON.parse(w.split("\n")[2] || "{}");
          return body.family !== null && body.family !== undefined;
        }),
      )
      .toBe(true);

    // Sin horas del plan: el toque de esta prueba es solo el de la familia.
    const section = b.page.getByTestId("push-section");
    for (const type of [/^Suplementos/, /^Comidas y meriendas/, /^Agua/])
      await section.getByRole("checkbox", { name: type }).uncheck();
    await expect
      .poll(async () => (await editCopy(b.page, "read")).items.length)
      .toBe(0);
    await b.page.goto("about:blank");

    // Mamá avisa.
    await a.page.goto("/");
    await a.page.getByRole("button", { name: "Avisar a la familia" }).click();
    await a.page.getByLabel("Tu aviso").fill(NOTE);
    await axe(a.page, "avisar a la familia · formulario");
    const touch = a.page.waitForResponse((r) =>
      r.url().endsWith("/api/push/family"),
    );
    await a.page.getByRole("button", { name: "Enviar aviso" }).click();
    await expect(a.page.getByText("✓ Aviso enviado.")).toBeVisible();
    const res = await touch;
    expect(res.status()).toBe(200);
    expect((await res.json()).sent).toBe(1);
    await axe(a.page, "avisar a la familia · enviado");
    expect(JSON.parse(res.request().postData() ?? "{}")).toEqual({
      family: expect.any(String),
      // El teléfono de Mamá no tiene avisos: no hay quién excluir del toque.
      from: null,
    });

    // El toque llega al teléfono de Papá; el trabajador baja la nota y la abre AQUÍ.
    // Una pestaña del mismo origen que NO corre la app: así la página no baja la nota antes
    // que el trabajador (con la app abierta, quien la ve es la propia pantalla).
    const page = await b.context.newPage();
    await page.goto("/manifest.webmanifest");
    const shown = await deliverPush(page, baseURL!, "reset");
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe(`Aviso de ${MAMA}`);
    expect(shown[0].body).toBe(NOTE);
    expect(shown[0].url).toBe("/#avisos");

    // Al tocarlo se abre Hoy en el aviso, con quién lo escribió.
    await page.goto(shown[0].url);
    const notice = page.getByTestId("family-notices");
    await expect(notice).toContainText(NOTE, { timeout: 25_000 });
    await expect(notice).toContainText(`Por ${MAMA}`);
    await axe(page, "avisar a la familia · recibido");

    // Ni la nota ni los nombres viajaron en claro hacia ninguna de las dos rutas.
    noPlain([...a.wire, ...b.wire], [NOTE, "quinoa", MAMA, PAPA, "Desayuno"]);
    await a.context.close();
    await b.context.close();
  });
});

test.describe("estados de los avisos que no son el camino feliz (axe en los dos temas)", () => {
  async function open(page: Page) {
    await page.goto("/ajustes");
    const section = page.getByTestId("push-section");
    await expect(section).toBeVisible();
    return section;
  }

  test("el navegador no sabe de avisos: lo dice con texto y símbolo", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!, { noPush: true });
    const section = await open(a.page);
    await expect(section).toContainText(
      "ℹ Este navegador no puede mostrar avisos",
    );
    await expect(
      section.getByRole("button", { name: "Activar avisos en este teléfono" }),
    ).toHaveCount(0);
    await axe(a.page, "avisos · navegador sin soporte");
    await a.context.close();
  });

  test("el permiso está bloqueado: ⚠ y cómo cambiarlo, sin pedir nada", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!, { denied: true });
    const section = await open(a.page);
    await expect(section).toContainText("⚠ El permiso está bloqueado");
    await axe(a.page, "avisos · permiso bloqueado");
    await a.context.close();
  });

  test("iPhone sin instalar la app: los 4 pasos de instalación", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!, { ios: true });
    const section = await open(a.page);
    const steps = section.getByTestId("push-install");
    await expect(steps).toContainText("Primero instala la app en tu iPhone");
    await expect(steps.getByRole("listitem")).toHaveCount(4);
    await axe(a.page, "avisos · iPhone sin instalar");
    await a.context.close();
  });

  test("el servicio no está disponible: ℹ y el resto de la app sigue igual", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await a.context.route("**/api/push/health", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: false, store: "none", key: null }),
      }),
    );
    const section = await open(a.page);
    const button = section.getByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(section).toContainText("ℹ Los avisos no están disponibles");
    expect(
      await a.page.evaluate(() => window.localStorage.getItem("e2e.asked")),
    ).toBeNull(); // no se pidió permiso
    await axe(a.page, "avisos · servicio no disponible");
    await a.context.close();
  });

  test("sin conexión al activar: el error rojo lleva ⚠ y texto", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await a.context.route("**/api/push/health", (route) => route.abort());
    const section = await open(a.page);
    const button = section.getByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(section.getByRole("alert")).toContainText("⚠ Sin conexión");
    await axe(a.page, "avisos · sin conexión");
    await a.context.close();
  });

  test("hay una versión nueva esperando: pide actualizar ANTES de pedir el permiso", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!, { updateWaiting: true });
    const section = await open(a.page);
    const button = section.getByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(section.getByRole("alert")).toContainText(
      "⚠ Hay una versión nueva de la app esperando",
    );
    expect(
      await a.page.evaluate(() => window.localStorage.getItem("e2e.asked")),
    ).toBeNull();
    await axe(a.page, "avisos · versión nueva esperando");
    await a.context.close();
  });

  test("el servidor no guarda: el error rojo lleva ⚠ y texto", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!process.env.CI, NEEDS_SW);
    const a = await phone(browser, baseURL!);
    await a.context.route("**/api/push/subscribe", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "x" }),
      }),
    );
    await a.page.goto("/ajustes");
    const section = a.page.getByTestId("push-section");
    const button = section.getByRole("button", {
      name: "Activar avisos en este teléfono",
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(section.getByRole("alert")).toContainText(
      "⚠ No se pudo guardar",
      { timeout: 15_000 },
    );
    await axe(a.page, "avisos · el servidor no guarda");
    await a.context.close();
  });

  test("«Avisar a la familia»: nota vacía y nota guardada sin red, ambas con texto y símbolo", async ({
    browser,
    baseURL,
  }) => {
    const a = await phone(browser, baseURL!);
    await a.page.goto("/ajustes");
    await a.page.getByTestId("family-create").click();
    await a.page.getByLabel(/Nombre de este teléfono/).fill(MAMA);
    await a.page
      .getByRole("checkbox", { name: /Entiendo qué se comparte/ })
      .check();
    await a.page.getByRole("button", { name: "Crear la familia" }).click();
    await expect(a.page.getByTestId("family-secrets")).toBeVisible();
    await a.page.getByRole("checkbox", { name: /Ya los anoté/ }).check();
    await a.page.getByRole("button", { name: "Listo" }).click();
    await expect(a.page.getByTestId("family-panel")).toBeVisible();

    await a.page.goto("/");
    await a.page.getByRole("button", { name: "Avisar a la familia" }).click();
    await a.page.getByRole("button", { name: "Enviar aviso" }).click();
    await expect(
      a.page.getByTestId("family-notices").getByRole("alert"),
    ).toContainText("⚠ Escribe algo antes de enviar.");
    await axe(a.page, "avisar a la familia · nota vacía");

    await a.page.getByLabel("Tu aviso").fill("Nota sin red");
    await a.context.setOffline(true);
    await a.page.getByRole("button", { name: "Enviar aviso" }).click();
    await expect(
      a.page.getByText("✓ Guardado. Se envía cuando vuelva la red."),
    ).toBeVisible();
    await axe(a.page, "avisar a la familia · guardada sin red");
    await a.context.close();
  });
});

test.describe("el reloj de 5 minutos (/api/push/tick)", () => {
  // Un toque firmado manda lo vencido de TODO el servidor y marca «enviado»: dos pruebas del
  // reloj a la vez (una por proyecto) se pisarían los conteos. Corren una tras otra, en uno.
  const ONE_PROJECT =
    "el reloj es del servidor entero: un solo proyecto lo mide";
  test.describe.configure({ mode: "serial" });
  const CURRENT = () => process.env.E2E_QSTASH_CURRENT!;
  const EVERY_DAY = 127;
  let n = 0;

  async function api(request: APIRequestContext, op: string, data: unknown) {
    n += 1;
    return request.post(`/api/push/${op}`, {
      data,
      headers: {
        "x-forwarded-for": `10.${200 + (n % 50)}.${n}.${Date.now() % 250}`,
      },
    });
  }

  async function subscribeDue(
    request: APIRequestContext,
    minute: number,
  ): Promise<{ id: string; token: string }> {
    const token = Buffer.from(
      Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
    ).toString("base64url");
    const res = await api(request, "subscribe", {
      endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${token.slice(0, 10)}`,
      token,
      tz: "UTC",
      wakes: [{ m: minute, d: EVERY_DAY }],
      family: null,
    });
    expect(res.status()).toBe(201);
    return { id: (await res.json()).id, token };
  }

  const utcMinute = () => {
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };

  async function tick(request: APIRequestContext, sign: string | null) {
    return request.post("/api/push/tick", {
      headers: sign ? { "upstash-signature": sign } : {},
      data: "",
    });
  }

  test("responde que está disponible y sin llaves reales (el doble del almacén)", async ({
    request,
  }) => {
    const res = await request.get("/api/push/health");
    expect(res.status()).toBe(200);
    const h = await res.json();
    expect(h.available).toBe(true);
    expect(h.store).toBe("memory");
    expect(h.key).toBe(process.env.E2E_VAPID_PUBLIC);
  });

  test("solo acepta su propia firma: sin firma, con otra llave, con otra ruta o con otro cuerpo, no", async ({
    request,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", ONE_PROJECT);
    const url = `${baseURL}/api/push/tick`;
    const now = Date.now();
    expect((await tick(request, null)).status()).toBe(401);
    expect((await tick(request, "a.b.c")).status()).toBe(401);
    const otherKey = await signLikeQstash("otra-llave", url, "", now);
    expect((await tick(request, otherKey)).status()).toBe(401);
    const otherPath = await signLikeQstash(
      CURRENT(),
      `${baseURL}/api/push/family`,
      "",
      now,
    );
    expect((await tick(request, otherPath)).status()).toBe(401);
    const otherBody = await signLikeQstash(CURRENT(), url, "otro", now);
    expect((await tick(request, otherBody)).status()).toBe(401);
    const old = await signLikeQstash(CURRENT(), url, "", now - 3_600_000);
    expect((await tick(request, old)).status()).toBe(401);
    const ok = await signLikeQstash(CURRENT(), url, "", now);
    expect((await tick(request, ok)).status()).toBe(200);
  });

  test("toca lo que venció UNA sola vez, respeta lo que el teléfono pidió saltar y manda el toque vacío", async ({
    request,
    baseURL,
  }, testInfo) => {
    // Los conteos del reloj son de todo el servidor: un solo proyecto a la vez los mide.
    test.skip(testInfo.project.name !== "mobile-chromium", ONE_PROJECT);
    const url = `${baseURL}/api/push/tick`;
    const minute = utcMinute();
    await subscribeDue(request, minute);
    const skipped = await subscribeDue(request, minute);
    const today = new Date().toISOString().slice(0, 10);
    const skip = await request.post("/api/push/skip", {
      headers: { authorization: `Bearer ${skipped.token}` },
      data: { id: skipped.id, date: today, m: minute, on: true },
    });
    expect(skip.status()).toBe(200);

    const first = await (
      await tick(request, await signLikeQstash(CURRENT(), url, "", Date.now()))
    ).json();
    expect(first.due).toBeGreaterThanOrEqual(1);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(first.skipped).toBeGreaterThanOrEqual(1);
    expect(first.failed).toBe(0);

    // Un toque doble (el disparador repite o llega tarde) no repite el aviso.
    const second = await (
      await tick(request, await signLikeQstash(CURRENT(), url, "", Date.now()))
    ).json();
    expect(second.due).toBeLessThan(first.due);
  });
});
