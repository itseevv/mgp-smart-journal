import { capsulePath, capsuleUrl } from "./app-base-url.ts";

export type AdminCsvCapsuleSummary = {
  batchName: string;
  serialNumber: string;
  productType: string;
  publicToken: string;
  fulfillmentStatus: string;
  recoveryStatus: string;
  activationStatus: string;
  createdAt: string;
};

export type RecoveryHandoffCsvItem = {
  serialNumber: string;
  capsuleUrl: string;
  recoveryCode: string;
};

export function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function handoffCsv(items: RecoveryHandoffCsvItem[]) {
  const header = ["serial_number", "capsule_url", "recovery_passcode"];
  return [
    "# SENSITIVE RECOVERY HANDOFF - plaintext passcodes are shown once",
    header.join(","),
    ...items.map((item) =>
      [
        csvEscape(item.serialNumber),
        csvEscape(item.capsuleUrl),
        csvEscape(item.recoveryCode),
      ].join(","),
    ),
  ].join("\n");
}

export function capsuleListCsv(
  capsules: AdminCsvCapsuleSummary[],
  appBaseUrl: string,
) {
  const header = [
    "batch_name",
    "serial_number",
    "product_type",
    "public_token",
    "capsule_path",
    "capsule_url",
    "fulfillment_status",
    "recovery_status",
    "activation_status",
    "created_at",
  ];
  return [
    header.join(","),
    ...capsules.map((capsule) =>
      [
        capsule.batchName,
        capsule.serialNumber,
        capsule.productType,
        capsule.publicToken,
        capsulePath(capsule.publicToken),
        capsuleUrl(appBaseUrl, capsule.publicToken),
        capsule.fulfillmentStatus,
        capsule.recoveryStatus,
        capsule.activationStatus,
        capsule.createdAt,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
}
