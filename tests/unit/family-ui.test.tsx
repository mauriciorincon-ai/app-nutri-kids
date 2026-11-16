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

import { ChecklistRow } from "@/components/day-checklist/checklist-row";
import { FamilySection } from "@/components/family/family-section";
import { useWho } from "@/components/family/use-family";
import { I18nProvider } from "@/i18n";
import { clearDevice } from "@/lib/device";
import { getFamily } from "@/lib/family/controller";
import { handle } from "@/lib/family/server/handler";
import { createMemoryStore } from "@/lib/family/server/memory";
import type { FamilyStore } from "@/lib/family/server/store";
import { loadFamilyState } from "@/lib/family/state";
import { savePrefs } from "@/lib/diet/storage";

type Net = { store: FamilyStore | null; offline: boolean; denied: boolean };

function stubNetwork(net: Net) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (net.offline) throw new TypeError("Failed to fetch");
      const op = String(url).replace("/api/family/", "");
      const headers = (init.headers ?? {}) as Record<string, string>;
      if (net.denied && op === "pull")
        return new Response(JSON.stringify({ error: "denied" }), {
          status: 403,
        });
      const out = await handle(
        {
          op,
          method: "POST",
          body: String(init.body ?? ""),
          authorization: headers.authorization ?? null,
          ip: "203.0.113.7",
        },
        net.store,
      );
      return new Response(JSON.stringify(out.json), { status: out.status });
    }),
  );
}

function renderSection() {
  return render(
    <I18nProvider>
      <FamilySection />
    </I18nProvider>,
  );
}

// Cada paso de cifrado hace 600 000 vueltas: en una máquina cargada puede pasar de 1 s.
configure({ asyncUtilTimeout: 6000 });

const net: Net = { store: null, offline: false, denied: false };

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  net.store = createMemoryStore({ isolated: true });
  net.offline = false;
  net.denied = false;
  stubNetwork(net);
});
afterEach(async () => {
  await getFamily().leave();
  clearDevice();
  vi.unstubAllGlobals();
});

async function createFamilyThroughUi(user: ReturnType<typeof userEvent.setup>) {
  renderSection();
  const create = await screen.findByTestId("family-create");
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await user.type(
    await screen.findByLabelText(/Nombre de este teléfono/),
    "Mamá",
  );
  await user.click(
    screen.getByRole("checkbox", { name: /Entiendo qué se comparte/ }),
  );
  await user.click(screen.getByRole("button", { name: "Crear la familia" }));
  return screen.findByTestId("family-secrets");
}

describe("Compartir con la familia (Ajustes)", () => {
  it("sin servicio: lo dice, no ofrece crear y explica que la app sigue completa", async () => {
    net.store = null;
    const user = userEvent.setup();
    renderSection();
    // Mientras nadie elige crear o entrar, no se pregunta nada a la red.
    expect(screen.queryByTestId("family-unavailable")).toBeNull();
    await user.click(screen.getByTestId("family-create"));
    expect(await screen.findByTestId("family-unavailable")).toHaveTextContent(
      "no responde",
    );
    expect(screen.queryByTestId("family-create-form")).toBeNull();
    await user.click(screen.getByTestId("family-join"));
    expect(await screen.findByTestId("family-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("family-join-form")).toBeNull();
  });

  it("sin red: lo dice y no ofrece crear", async () => {
    net.offline = true;
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByTestId("family-create"));
    expect(await screen.findByTestId("family-offline")).toHaveTextContent(
      "Sin conexión",
    );
    expect(screen.queryByTestId("family-create-form")).toBeNull();
  });

  it("dice qué se comparte, qué se queda y que va cifrado, antes de pedir nada", async () => {
    renderSection();
    expect(
      await screen.findByText(/alergias y medicamentos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/El idioma, el tema/)).toBeInTheDocument();
    expect(screen.getByText(/ni nosotros/)).toBeInTheDocument();
  });

  it("crear: consentimiento y nombre primero; el código y la frase se muestran una vez; luego el panel", async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("family-create")).toBeEnabled(),
    );
    await user.click(screen.getByTestId("family-create"));
    const submit = await screen.findByRole("button", {
      name: "Crear la familia",
    });
    expect(submit).toBeDisabled(); // sin nombre ni consentimiento
    await user.type(
      await screen.findByLabelText(/Nombre de este teléfono/),
      "Mamá",
    );
    expect(submit).toBeDisabled(); // falta el consentimiento
    await user.click(
      screen.getByRole("checkbox", { name: /Entiendo qué se comparte/ }),
    );
    expect(submit).toBeEnabled();
    await user.click(submit);

    const secrets = await screen.findByTestId("family-secrets");
    expect(within(secrets).getByTestId("family-code")).toHaveTextContent(
      /^[0-9A-Z]{5}-[0-9A-Z]{5}$/,
    );
    expect(within(secrets).getByTestId("family-phrase")).toHaveTextContent(
      /^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/,
    );
    const done = within(secrets).getByRole("button", { name: "Listo" });
    expect(done).toBeDisabled();
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(done);

    const panel = await screen.findByTestId("family-panel");
    expect(within(panel).getByTestId("family-status")).toHaveTextContent(
      "Al día",
    );
    expect(within(panel).getByTestId("family-phones")).toHaveTextContent(
      "Mamá",
    );
    expect(within(panel).getByText("Este teléfono")).toBeInTheDocument();
    // La frase no queda en pantalla ni en el teléfono.
    expect(screen.queryByTestId("family-phrase")).toBeNull();
  });

  it("el consentimiento dice que perder la frase no tiene vuelta y que se puede salir", async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("family-create")).toBeEnabled(),
    );
    await user.click(screen.getByTestId("family-create"));
    const form = await screen.findByTestId("family-create-form");
    expect(form).toHaveTextContent(/si se pierde la frase/i);
    expect(form).toHaveTextContent(/Salir de la familia/);
    expect(form).toHaveTextContent(/Borrar lo compartido/);
  });

  it("si el teléfono no puede guardar las claves, la pantalla de la frase lo avisa", async () => {
    const user = userEvent.setup();
    const broken = {
      open: () => {
        throw new Error("SecurityError");
      },
    };
    (globalThis as { indexedDB: unknown }).indexedDB = broken;
    const secrets = await createFamilyThroughUi(user);
    expect(within(secrets).getByRole("alert")).toHaveTextContent(
      /No se pudo guardar la clave/,
    );
  });

  it("entrar: código o frase equivocados se explican; el nombre y el consentimiento son obligatorios", async () => {
    const user = userEvent.setup();
    // Otra familia ya creada.
    const user2 = userEvent.setup();
    const secrets = await (async () => {
      const view = await createFamilyThroughUi(user2);
      const code = within(view).getByTestId("family-code").textContent!;
      const phrase = within(view).getByTestId("family-phrase").textContent!;
      return { code, phrase };
    })();
    await getFamily().leave();
    document.body.innerHTML = "";

    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("family-join")).toBeEnabled(),
    );
    await user.click(screen.getByTestId("family-join"));
    const submit = screen.getByRole("button", { name: "Entrar" });
    await user.type(await screen.findByLabelText("Código"), "ZZZZZ-ZZZZZ");
    await user.type(await screen.findByLabelText("Frase"), secrets.phrase);
    await user.type(
      await screen.findByLabelText(/Nombre de este teléfono/),
      "Abuela",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Entiendo qué se comparte/ }),
    );
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos una familia con ese código.",
    );

    await user.clear(screen.getByLabelText("Código"));
    await user.type(await screen.findByLabelText("Código"), secrets.code);
    await user.clear(screen.getByLabelText("Frase"));
    await user.type(
      await screen.findByLabelText("Frase"),
      "AAAA-AAAA-AAAA-AAAA-AAAA",
    );
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esa frase no es la de la familia.",
    );

    await user.clear(screen.getByLabelText("Frase"));
    await user.type(await screen.findByLabelText("Frase"), secrets.phrase);
    await user.click(submit);
    const panel = await screen.findByTestId("family-panel");
    expect(within(panel).getByTestId("family-phones")).toHaveTextContent(
      "Abuela",
    );
  });

  it("sin red en la familia: dice «Sin conexión» y que los cambios se suben al volver", async () => {
    const user = userEvent.setup();
    const secrets = await createFamilyThroughUi(user);
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(within(secrets).getByRole("button", { name: "Listo" }));
    net.offline = true;
    await getFamily().sync();
    const panel = await screen.findByTestId("family-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("family-status")).toHaveTextContent(
        "Sin conexión",
      ),
    );
    expect(panel).toHaveTextContent("se suben cuando vuelva internet");
    net.offline = false;
    await getFamily().sync();
    await waitFor(() =>
      expect(within(panel).getByTestId("family-status")).toHaveTextContent(
        "Al día",
      ),
    );
  });

  it("si la frase cambió o te sacaron: pide la frase nueva con el mismo código", async () => {
    const user = userEvent.setup();
    const secrets = await createFamilyThroughUi(user);
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(within(secrets).getByRole("button", { name: "Listo" }));
    net.denied = true;
    await getFamily().sync();
    await waitFor(() =>
      expect(screen.getByTestId("family-status")).toHaveTextContent(
        "Frase cambiada",
      ),
    );
    const form = screen.getByTestId("family-join-form");
    expect(within(form).getByLabelText("Código")).toHaveAttribute("readonly");
    expect(within(form).queryByLabelText(/Nombre de este teléfono/)).toBeNull();
  });

  it("cambiar la frase muestra la nueva una vez, tras confirmar", async () => {
    const user = userEvent.setup();
    const secrets = await createFamilyThroughUi(user);
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(within(secrets).getByRole("button", { name: "Listo" }));
    await user.click(await screen.findByTestId("family-rotate"));
    await user.click(await screen.findByTestId("family-rotate-yes"));
    const card = await screen.findByTestId("family-secrets");
    expect(within(card).getByTestId("family-phrase")).toHaveTextContent(
      /^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/,
    );
    expect(loadFamilyState()!.epoch).toBe(2);
  });

  it("salir conserva los datos y avisa; borrar lo compartido borra del servidor", async () => {
    const user = userEvent.setup();
    const secrets = await createFamilyThroughUi(user);
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(within(secrets).getByRole("button", { name: "Listo" }));
    const family = loadFamilyState()!.family;

    await user.click(await screen.findByTestId("family-leave"));
    await user.click(await screen.findByTestId("family-leave-yes"));
    expect(await screen.findByTestId("family-notice")).toHaveTextContent(
      "Saliste de la familia",
    );
    expect(loadFamilyState()).toBeNull();
    expect(await net.store!.meta(family)).not.toBeNull(); // salir no borra lo compartido
  });

  it("borrar lo compartido", async () => {
    const user = userEvent.setup();
    const secrets = await createFamilyThroughUi(user);
    await user.click(within(secrets).getByRole("checkbox"));
    await user.click(within(secrets).getByRole("button", { name: "Listo" }));
    const family = loadFamilyState()!.family;
    await user.click(await screen.findByTestId("family-destroy"));
    await user.click(await screen.findByTestId("family-destroy-yes"));
    expect(await screen.findByTestId("family-notice")).toHaveTextContent(
      "Se borró lo compartido",
    );
    expect(await net.store!.meta(family)).toBeNull();
  });
});

describe("«Por <nombre>»", () => {
  function Row({ id }: { id: string }) {
    const who = useWho();
    return (
      <ChecklistRow
        done
        onToggle={() => {}}
        title="Desayuno"
        by={who(id)}
        ariaLabel="x"
      />
    );
  }

  it("sin familia no se ve; la fila marcada con `by` lo muestra", async () => {
    savePrefs({ locale: "es", disclaimerSeen: true, chatIntroSeen: true });
    const { unmount } = render(
      <I18nProvider>
        <Row id="ABC" />
      </I18nProvider>,
    );
    expect(screen.queryByTestId("checklist-by")).toBeNull();
    unmount();
    render(
      <I18nProvider>
        <ChecklistRow
          done
          onToggle={() => {}}
          title="Desayuno"
          by="Por Mamá"
          ariaLabel="x"
        />
      </I18nProvider>,
    );
    expect(screen.getByTestId("checklist-by")).toHaveTextContent("Por Mamá");
  });
});
