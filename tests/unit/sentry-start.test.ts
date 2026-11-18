import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sentry se inicia cuando el navegador queda libre (`src/instrumentation-client.ts`): lo que
 * importa es que siga iniciándose con el mismo filtro de privacidad, que los errores de antes no
 * se pierdan y que las transiciones de ruta lleguen una vez iniciado.
 */

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sdk);

beforeEach(() => {
  vi.resetModules();
  sdk.init.mockClear();
  sdk.captureException.mockClear();
  sdk.captureRouterTransitionStart.mockClear();
});

describe("startSentry", () => {
  it("inicia sin datos personales, con el filtro de privacidad y envía lo temprano", async () => {
    const { startSentry } = await import("@/lib/privacy/sentry-start");
    const early = [new Error("antes de iniciar"), "texto"];
    const onTransition = startSentry(early);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    const options = sdk.init.mock.calls[0][0];
    expect(options).toMatchObject({
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
    });
    expect(typeof options.beforeSend).toBe("function");
    expect(typeof options.beforeSendTransaction).toBe("function");
    // El filtro corre de verdad: una URL con datos sale sin su consulta.
    const out = options.beforeSend({
      request: { url: "https://x.test/a?q=pollo" },
    });
    expect(JSON.stringify(out)).not.toContain("pollo");
    expect(sdk.captureException.mock.calls.map((c) => c[0])).toEqual(early);
    expect(onTransition).toBe(sdk.captureRouterTransitionStart);
  });
});

describe("instrumentation-client", () => {
  it("no carga Sentry durante la carga; lo inicia al quedar libre y le pasa los errores previos", async () => {
    let idle: (() => void) | null = null;
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
      idle = cb;
      return 1;
    });
    const client = await import("@/instrumentation-client");
    if (document.readyState !== "complete")
      window.dispatchEvent(new Event("load"));
    expect(sdk.init).not.toHaveBeenCalled();

    const boom = new Error("temprano");
    window.dispatchEvent(new ErrorEvent("error", { error: boom }));
    client.onRouterTransitionStart("/dieta", "push"); // antes de iniciar: no rompe
    expect(sdk.captureRouterTransitionStart).not.toHaveBeenCalled();

    expect(idle).not.toBeNull();
    const off = vi.spyOn(window, "removeEventListener");
    idle!();
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledTimes(1));
    expect(sdk.captureException).toHaveBeenCalledWith(boom);

    // Ya iniciado: las transiciones llegan a Sentry y la cola ya no escucha (los errores nuevos los toma Sentry).
    client.onRouterTransitionStart("/historial", "push");
    expect(sdk.captureRouterTransitionStart).toHaveBeenCalledWith(
      "/historial",
      "push",
    );
    expect(off).toHaveBeenCalledWith("error", expect.any(Function));
    expect(off).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function),
    );
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    off.mockRestore();
    vi.unstubAllGlobals();
  });
});
