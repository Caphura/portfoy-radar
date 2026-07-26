import type { Enums } from "@/types/database.generated";

export type QuickFsboPlatform =
  | "sahibinden"
  | "hepsiemlak"
  | "emlakjet"
  | "other";

export const quickFsboPlatformOptions = [
  { value: "sahibinden", label: "sahibinden.com" },
  { value: "hepsiemlak", label: "Hepsiemlak" },
  { value: "emlakjet", label: "Emlakjet" },
  { value: "other", label: "Diğer platform" },
] as const satisfies readonly {
  value: QuickFsboPlatform;
  label: string;
}[];

export const propertyTypeOptions = [
  { value: "apartment", label: "Daire" },
  { value: "detached_house", label: "Müstakil ev" },
  { value: "residence", label: "Rezidans" },
  { value: "commercial", label: "Ticari" },
  { value: "land", label: "Arsa" },
  { value: "other", label: "Diğer" },
] as const satisfies readonly {
  value: Enums<"property_type">;
  label: string;
}[];

export const transactionTypeOptions = [
  { value: "sale", label: "Satılık" },
  { value: "rent", label: "Kiralık" },
] as const satisfies readonly {
  value: Enums<"listing_transaction_type">;
  label: string;
}[];
