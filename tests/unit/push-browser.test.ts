import { afterEach, describe, expect, it } from "vitest";

import { browserPush } from "@/lib/push/browser";

/** `updatePending`: una versión nueva esperando turno no sabe mostrar avisos todavía. */

function stubWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    value,
    configurable: true,
  });
}

describe("browserPush · versión nueva esperando", () => {
  afterEach(() => stubWorker(undefined));

  it("dice sí solo si hay un trabajador en espera", async () => {
    stubWorker({ getRegistration: async () => ({ waiting: {} }) });
    expect(await browserPush().updatePending()).toBe(true);
    stubWorker({ getRegistration: async () => ({ waiting: null }) });
    expect(await browserPush().updatePending()).toBe(false);
    stubWorker({ getRegistration: async () => undefined });
    expect(await browserPush().updatePending()).toBe(false);
  });

  it("sin trabajadores o si el navegador falla, no bloquea", async () => {
    stubWorker(undefined);
    expect(await browserPush().updatePending()).toBe(false);
    stubWorker({
      getRegistration: async () => {
        throw new Error("x");
      },
    });
    expect(await browserPush().updatePending()).toBe(false);
  });
});
