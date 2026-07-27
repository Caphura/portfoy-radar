import type { CsvImportError } from "./fsbo-csv-contract";
import type { CsvPreview } from "@/server/csv/csv-fsbo-service";

export type CsvImportActionState = {
  status: "idle" | "error" | "review" | "success";
  formError: string | null;
  validationErrors: CsvImportError[];
  decisionErrors: Record<number, string>;
  preview: CsvPreview | null;
  success:
    | {
        message: string;
        processedCount: number;
        createdNewCount: number;
        usedExistingCount: number;
        linkedExistingPropertyCount: number;
        createdSeparateCount: number;
      }
    | null;
};

export const initialCsvImportActionState: CsvImportActionState = {
  status: "idle",
  formError: null,
  validationErrors: [],
  decisionErrors: {},
  preview: null,
  success: null,
};
