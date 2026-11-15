import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Las pruebas de scripts del kit corren en `node` (sin window).
  if (typeof window !== "undefined") window.localStorage.clear();
});
