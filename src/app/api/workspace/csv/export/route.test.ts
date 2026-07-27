// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const { exportWorkspaceFsboCsvMock } = vi.hoisted(() => ({
  exportWorkspaceFsboCsvMock: vi.fn(),
}));

vi.mock("@/server/csv/csv-fsbo-service", () => ({
  exportWorkspaceFsboCsv: exportWorkspaceFsboCsvMock,
}));

import { GET } from "./route";

describe("GET /api/workspace/csv/export", () => {
  it("maskeli CSV’yi indirme ve no-store başlıklarıyla döndürür", async () => {
    exportWorkspaceFsboCsvMock.mockResolvedValue({
      ok: true,
      data: {
        content: "\uFEFFalan\r\n",
        filename: "portfoy-radar-fsbo-2026-07-27.csv",
        totalCount: 1,
        truncated: false,
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("alan\r\n");
  });

  it("yetkisiz isteği CSV ayrıntısı sızdırmadan reddeder", async () => {
    exportWorkspaceFsboCsvMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Yetkiniz bulunmuyor." },
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "Yetkiniz bulunmuyor.",
    });
  });
});
