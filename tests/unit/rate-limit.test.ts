import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimit());

describe("rateLimit", () => {
  it("permite hasta el límite y luego bloquea", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) {
      expect(rateLimit("ip-a", 20, 60_000, t0).ok).toBe(true);
    }
    const blocked = rateLimit("ip-a", 20, 60_000, t0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("cuenta por IP de forma independiente", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 20; i++) rateLimit("ip-b", 20, 60_000, t0);
    expect(rateLimit("ip-b", 20, 60_000, t0).ok).toBe(false);
    expect(rateLimit("ip-c", 20, 60_000, t0).ok).toBe(true);
  });

  it("reinicia al pasar la ventana", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 20; i++) rateLimit("ip-d", 20, 60_000, t0);
    expect(rateLimit("ip-d", 20, 60_000, t0).ok).toBe(false);
    expect(rateLimit("ip-d", 20, 60_000, t0 + 60_001).ok).toBe(true);
  });
});
