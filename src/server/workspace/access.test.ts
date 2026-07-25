import { describe, expect, it } from "vitest";

import { isWorkspaceRoleAllowed } from "./roles";

describe("isWorkspaceRoleAllowed", () => {
  it("owner rolünü owner işlemlerinde kabul eder", () => {
    expect(isWorkspaceRoleAllowed("owner", ["owner"])).toBe(true);
  });

  it("viewer rolünü owner işlemlerinde reddeder", () => {
    expect(isWorkspaceRoleAllowed("viewer", ["owner"])).toBe(false);
  });

  it("paylaşılan okuma yetkisinde bütün onaylı rolleri kabul eder", () => {
    expect(
      isWorkspaceRoleAllowed("advisor", ["owner", "advisor", "viewer"]),
    ).toBe(true);
  });
});
