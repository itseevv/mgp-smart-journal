import { capsuleUrl } from "./app-base-url.ts";

export type AdminRecoveryCapsuleDetail = {
  ok?: boolean;
  capsule?: {
    publicToken: string;
    serialNumber: string;
  };
};

export type AdminRecoveryIssueResult = {
  recoveryCode?: string;
  codeVersion?: number;
};

export type AdminRecoveryHandoffResult =
  | {
      ok: true;
      capsuleId: string;
      capsuleUrl: string;
      serialNumber: string;
      recoveryCode: string;
      codeVersion?: number;
      sensitive: true;
    }
  | { ok: false; code: "NOT_FOUND" | "ISSUANCE_FAILED" };

export async function createAdminRecoveryHandoff(input: {
  capsuleId: string;
  appBaseUrl: string;
  getDetail: (capsuleId: string) => Promise<AdminRecoveryCapsuleDetail>;
  issueRecovery: (capsuleId: string) => Promise<AdminRecoveryIssueResult>;
}): Promise<AdminRecoveryHandoffResult> {
  const detail = await input.getDetail(input.capsuleId);
  if (!detail.ok || !detail.capsule) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const recovery = await input.issueRecovery(input.capsuleId);
  if (!recovery.recoveryCode) {
    return { ok: false, code: "ISSUANCE_FAILED" };
  }

  return {
    ok: true,
    capsuleId: input.capsuleId,
    serialNumber: detail.capsule.serialNumber,
    capsuleUrl: capsuleUrl(input.appBaseUrl, detail.capsule.publicToken),
    recoveryCode: recovery.recoveryCode,
    codeVersion: recovery.codeVersion,
    sensitive: true,
  };
}
