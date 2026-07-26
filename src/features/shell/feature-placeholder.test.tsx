import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FeaturePlaceholder } from "./feature-placeholder";

describe("FeaturePlaceholder", () => {
  afterEach(() => {
    cleanup();
  });

  it("kapsam dışı modülü sahte veri veya eylem olmadan Türkçe açıklar", () => {
    render(
      <FeaturePlaceholder
        description="Bu özellik ilgili ürün diliminde açılacak."
        eyebrow="Planlama"
        title="Takvim"
      />,
    );

    expect(screen.getByRole("heading", { name: "Takvim" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Bu bölüm henüz kullanıma açık değil",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hazırlanıyor")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
