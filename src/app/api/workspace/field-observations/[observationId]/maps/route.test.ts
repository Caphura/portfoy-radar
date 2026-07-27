// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  auditAccessMock,
  loadSecureFieldObservationMock,
  revealFieldLocationMock,
} = vi.hoisted(() => ({
  auditAccessMock: vi.fn(),
  loadSecureFieldObservationMock: vi.fn(),
  revealFieldLocationMock: vi.fn(),
}));

vi.mock("@/server/field-observations/audit-access", () => ({
  auditFieldObservationAccess: auditAccessMock,
}));
vi.mock("@/server/field-observations/secure-record", () => ({
  loadSecureFieldObservation: loadSecureFieldObservationMock,
}));
vi.mock("@/server/field-observations/location-crypto", () => ({
  revealFieldLocation: revealFieldLocationMock,
}));

import { GET } from "./route";

const context = {
  params: Promise.resolve({
    observationId: "40000000-0000-4000-8000-000000000001",
  }),
};

describe("Google Maps saha yönlendirmesi", () => {
  beforeEach(() => {
    loadSecureFieldObservationMock.mockResolvedValue({
      ok: true,
      data: {
        id: "40000000-0000-4000-8000-000000000001",
        locationEnvelope: { synthetic: true },
      },
    });
    revealFieldLocationMock.mockReturnValue({
      ok: true,
      data: {
        latitude: 41.0082,
        longitude: 28.9784,
        accuracy: 10,
        capturedAt: "2026-07-28T09:00:00.000Z",
      },
    });
    auditAccessMock.mockResolvedValue(true);
  });

  it("harita görünümünü açık kullanıcı eylemi, audit ve no-referrer ile açar", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/workspace/field-observations/40000000-0000-4000-8000-000000000001/maps?intent=view",
      ),
      context,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "https://www.google.com/maps/search/?api=1",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(auditAccessMock).toHaveBeenCalledWith(
      "40000000-0000-4000-8000-000000000001",
      "field_observation.maps_viewed",
    );
  });

  it("yol tarifini anahtarsız directions URL'sine yönlendirir", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/workspace/field-observations/40000000-0000-4000-8000-000000000001/maps?intent=directions",
      ),
      context,
    );

    expect(response.headers.get("location")).toContain(
      "https://www.google.com/maps/dir/?api=1",
    );
    expect(response.headers.get("location")).toContain("travelmode=driving");
  });

  it("yetkisiz, konumsuz ve geçersiz intent isteklerini güvenli reddeder", async () => {
    loadSecureFieldObservationMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "Yetkiniz bulunmuyor." },
    });
    const forbidden = await GET(
      new Request(
        "https://example.test/api/workspace/field-observations/40000000-0000-4000-8000-000000000001/maps?intent=view",
      ),
      context,
    );
    const invalid = await GET(
      new Request(
        "https://example.test/api/workspace/field-observations/40000000-0000-4000-8000-000000000001/maps?intent=other",
      ),
      context,
    );

    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
  });
});
