import { readFileSync } from "node:fs";

const policyUrl = new URL("../config/release-policy.json", import.meta.url);
const policy = JSON.parse(readFileSync(policyUrl, "utf8"));
const manualGates = Array.isArray(policy.manualGates) ? policy.manualGates : [];
const pendingGateIds = manualGates
  .filter((gate) => gate?.status !== "approved" || !gate?.evidence)
  .map((gate) => gate?.id)
  .filter((id) => typeof id === "string");

if (
  policy.version !== "release-v1" ||
  policy.defaultDecision !== "blocked-until-approved" ||
  manualGates.length !== 3
) {
  console.error(
    "Canlı PII yayın politikası geçersiz. Release kapısı güvenli biçimde kapalı kaldı.",
  );
  process.exitCode = 1;
} else if (pendingGateIds.length > 0) {
  console.error(
    `Canlı PII yayın kapısı kapalı: ${pendingGateIds.join(", ")} kanıt bekliyor.`,
  );
  process.exitCode = 1;
} else {
  console.log("Canlı PII yayın kapısı onaylı kanıtlarla açık.");
}
