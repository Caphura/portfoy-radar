import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  liftContactCommunicationBlockAction: vi.fn(),
  markContactDoNotCallAction: vi.fn(),
}));

import { DoNotCallControl } from "./do-not-call-control";

const opportunityId = "10000000-0000-4000-8000-000000000001";

describe("DoNotCallControl", () => {
  afterEach(cleanup);

  it("aktif olmayan kişide mobil etki özeti, neden ve açık onay gösterir", () => {
    render(
      <DoNotCallControl
        active={false}
        canManage
        opportunityId={opportunityId}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Aranmayacak sistemi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Engel yok")).toBeInTheDocument();
    expect(screen.getByLabelText("Aranmayacak nedeni")).toBeRequired();
    expect(
      screen.getByRole("checkbox", {
        name: /bütün açık fırsatlarının kapanacağını/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kişiyi Aranmayacak yap" }),
    ).toBeEnabled();
    expect(screen.getByDisplayValue(opportunityId)).toHaveAttribute(
      "name",
      "opportunityId",
    );
    expect(screen.getByText(/Neden şifrelenir/i)).toBeInTheDocument();
  });

  it("aktif engelde kaldırma nedenini ve otomatik yeniden açmama uyarısını gösterir", () => {
    render(
      <DoNotCallControl
        active
        canManage
        opportunityId={opportunityId}
      />,
    );

    expect(screen.getByText("Engel aktif")).toBeInTheDocument();
    expect(screen.getByLabelText("Engel kaldırma nedeni")).toBeRequired();
    expect(
      screen.getByText(/eski fırsatlar ve görevler otomatik olarak yeniden açılmaz/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "İletişim engelini kaldır" }),
    ).toBeEnabled();
  });

  it("viewer için durumu gösterip yönetim formunu gizler", () => {
    render(
      <DoNotCallControl
        active
        canManage={false}
        opportunityId={opportunityId}
      />,
    );

    expect(screen.getByText("Engel aktif")).toBeInTheDocument();
    expect(
      screen.getByText(/yalnızca sahip veya danışman yönetebilir/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
