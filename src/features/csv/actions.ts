"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  DuplicateDecision,
} from "@/features/fsbo/duplicate-review";
import {
  confirmCsvFsboImport,
  previewCsvFsboImport,
  type CsvImportDecisionMap,
} from "@/server/csv/csv-fsbo-service";

import type { CsvImportActionState } from "./csv-import-state";

type CsvFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function readCsvFile(formData: FormData): CsvFile | null {
  const value = formData.get("csvFile");

  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    !("size" in value) ||
    !("type" in value) ||
    !("arrayBuffer" in value) ||
    typeof value.name !== "string" ||
    typeof value.size !== "number" ||
    typeof value.type !== "string" ||
    typeof value.arrayBuffer !== "function"
  ) {
    return null;
  }

  return value as CsvFile;
}

function errorState(
  previousState: CsvImportActionState,
  formError: string,
  options: {
    validationErrors?: CsvImportActionState["validationErrors"];
    decisionErrors?: CsvImportActionState["decisionErrors"];
    clearPreview?: boolean;
  } = {},
): CsvImportActionState {
  return {
    status: "error",
    formError,
    validationErrors: options.validationErrors ?? [],
    decisionErrors: options.decisionErrors ?? {},
    preview: options.clearPreview ? null : previousState.preview,
    success: null,
  };
}

function parseDecisions(
  formData: FormData,
  preview: NonNullable<CsvImportActionState["preview"]>,
):
  | { ok: true; data: CsvImportDecisionMap }
  | { ok: false; errors: Record<number, string> } {
  const decisions: Record<number, DuplicateDecision> = {};
  const errors: Record<number, string> = {};

  for (const row of preview.rows.filter((item) => item.candidateCount > 0)) {
    const decisionResult = z
      .enum(["use_existing", "link_existing_property", "keep_separate"])
      .safeParse(formData.get(`decision-${row.rowNumber}`));
    const candidateKey = formData.get(`candidate-${row.rowNumber}`);
    const candidate =
      typeof candidateKey === "string"
        ? row.candidates.find((item) => item.key === candidateKey)
        : null;

    if (!decisionResult.success || !candidate) {
      errors[row.rowNumber] =
        "Bu satır için geçerli bir aday ve açık karar seçin.";
      continue;
    }

    if (
      decisionResult.data === "link_existing_property" &&
      !candidate.linkable
    ) {
      errors[row.rowNumber] =
        "Seçilen aday yeni ilanı gayrimenkule bağlamak için uygun değil.";
      continue;
    }

    const rawReason = formData.get(`reason-${row.rowNumber}`);
    const reason = typeof rawReason === "string" ? rawReason.trim() : "";

    if (
      decisionResult.data === "keep_separate" &&
      (reason.length < 3 || reason.length > 500)
    ) {
      errors[row.rowNumber] =
        "Ayrı kayıt kararı için 3-500 karakterlik gerekçe girin.";
      continue;
    }

    decisions[row.rowNumber] = {
      decision: decisionResult.data,
      candidateKey: candidate.key,
      separationReason:
        decisionResult.data === "keep_separate" ? reason : null,
    };
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: decisions };
}

export async function manageCsvImportAction(
  previousState: CsvImportActionState,
  formData: FormData,
): Promise<CsvImportActionState> {
  const intent = formData.get("intent");
  const file = readCsvFile(formData);

  if (!file || file.size === 0) {
    return errorState(previousState, "Devam etmek için CSV dosyasını seçin.");
  }

  if (intent === "preview") {
    const result = await previewCsvFsboImport(file);

    if (!result.ok) {
      if (result.error.code === "UNAUTHENTICATED") {
        redirect("/giris");
      }

      return errorState(previousState, result.error.message, {
        ...(result.error.validationErrors
          ? { validationErrors: result.error.validationErrors }
          : {}),
        clearPreview: true,
      });
    }

    return {
      status: "review",
      formError: null,
      validationErrors: [],
      decisionErrors: {},
      preview: result.data,
      success: null,
    };
  }

  if (intent !== "confirm" || !previousState.preview) {
    return errorState(
      previousState,
      "Önce CSV dosyasını doğrulayıp önizleyin.",
      { clearPreview: true },
    );
  }

  const decisions = parseDecisions(formData, previousState.preview);

  if (!decisions.ok) {
    return errorState(
      previousState,
      "Mükerrer satır kararlarını tamamlayın.",
      { decisionErrors: decisions.errors },
    );
  }

  const result = await confirmCsvFsboImport(
    previousState.preview.previewId,
    file,
    decisions.data,
  );

  if (!result.ok) {
    if (result.error.code === "UNAUTHENTICATED") {
      redirect("/giris");
    }

    return errorState(previousState, result.error.message, {
      ...(result.error.validationErrors
        ? { validationErrors: result.error.validationErrors }
        : {}),
      clearPreview:
        result.error.code === "CSV_IMPORT_STALE" ||
        result.error.code === "INVALID_CSV",
    });
  }

  revalidatePath("/workspace");
  revalidatePath("/workspace/ekle");
  revalidatePath("/workspace/radar");
  revalidatePath("/workspace/raporlar");

  return {
    status: "success",
    formError: null,
    validationErrors: [],
    decisionErrors: {},
    preview: null,
    success: {
      message: `${result.data.processedCount} satır tek işlemde içe aktarıldı.`,
      processedCount: result.data.processedCount,
      createdNewCount: result.data.createdNewCount,
      usedExistingCount: result.data.usedExistingCount,
      linkedExistingPropertyCount:
        result.data.linkedExistingPropertyCount,
      createdSeparateCount: result.data.createdSeparateCount,
    },
  };
}
