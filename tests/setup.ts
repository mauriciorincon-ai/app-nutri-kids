import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Las pruebas de scripts del kit corren en `node` (sin window).
  if (typeof window !== "undefined") window.localStorage.clear();
});

// jsdom no trae ResizeObserver y los controles de Radix dentro de un <form> lo usan.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
}
