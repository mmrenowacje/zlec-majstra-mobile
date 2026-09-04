import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const required = [
  "DATABASE_URL",
  "PAYU_SANDBOX_CLIENT_ID",
  "PAYU_SANDBOX_CLIENT_SECRET",
  "PAYU_SANDBOX_POS_ID",
  "PAYU_SANDBOX_MD5_KEY",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `PayU sandbox test requires these environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

const evidenceRunId =
  process.env.PAYU_EVIDENCE_RUN_ID ?? `local-${process.pid}-${Date.now()}`;
const evidenceDir =
  process.env.PAYU_EVIDENCE_DIR ??
  `/tmp/payu-sandbox-evidence/${evidenceRunId}`;
mkdirSync(evidenceDir, { recursive: true });

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "tsx",
    "--test",
    "--test-name-pattern=creates a real sandbox checkout",
    "src/routes/marketplace.integration.test.ts",
  ],
  {
    cwd: fileURLToPath(new URL("../artifacts/api-server/", import.meta.url)),
    env: {
      ...process.env,
      PAYU_ENVIRONMENT: "sandbox",
      PAYU_SANDBOX_E2E: "true",
      PAYU_EVIDENCE_RUN_ID: evidenceRunId,
      PAYU_EVIDENCE_DIR: evidenceDir,
    },
    stdio: "inherit",
  },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const requiredEvidence = [
  "run.json",
  "result.json",
  "payu-checkout.trace.zip",
  "payu-web-return.png",
  "payu-callback.jsonl",
  "browser-native-return.log",
];
const missingEvidence = requiredEvidence.filter((fileName) => {
  try {
    return statSync(`${evidenceDir}/${fileName}`).size === 0;
  } catch {
    return true;
  }
});
if (missingEvidence.length > 0) {
  console.error(
    `PayU sandbox checkout passed without required evidence: ${missingEvidence.join(", ")}`,
  );
  process.exit(1);
}

console.log(`PayU sandbox evidence ready for run ${evidenceRunId}`);