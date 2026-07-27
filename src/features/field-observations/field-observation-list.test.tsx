import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldObservationList } from "./field-observation-list";

describe("saha gözlemi özet listesi", () => {
  it("boş durumu Türkçe ve açıklayıcı gösterir", () => {
    render(<FieldObservationList observations={[]} />);

    expect(screen.getByText("Henüz saha kaydı yok")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("thumbnail veya hassas alan göstermeden güvenli özetleri listeler", () => {
    const { container } = render(
      <FieldObservationList
        observations={[
          {
            id: "40000000-0000-4000-8000-000000000001",
            observedAt: "2026-07-28T09:00:00.000Z",
            createdAt: "2026-07-28T09:01:00.000Z",
            status: "ready",
            hasLocation: true,
            isLinked: false,
          },
          {
            id: "40000000-0000-4000-8000-000000000002",
            observedAt: "2026-07-28T10:00:00.000Z",
            createdAt: "2026-07-28T10:01:00.000Z",
            status: "ready",
            hasLocation: false,
            isLinked: true,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Konum eklendi · Bağlantı bekliyor/)).toBeInTheDocument();
    expect(
      screen.getByText(/Konum eklenmedi · FSBO’ya dönüştürüldü/),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("latitude");
    expect(container.textContent).not.toContain("object_path");
  });
});
