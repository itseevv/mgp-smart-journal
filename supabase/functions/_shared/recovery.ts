import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeConfig,
} from "../../../lib/recovery/config.ts";

function bytesToHex(bytes: Uint8Array) {
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function recoveryCodeHash(code: string, pepper: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `recovery:v${recoveryCodeConfig.hashVersion}:${normalizeRecoveryCode(code)}`,
    ),
  );
  return bytesToHex(new Uint8Array(signature));
}

export function generateRecoveryCode() {
  const alphabet = recoveryCodeConfig.alphabet;
  const unbiasedLimit = Math.floor(256 / alphabet.length) * alphabet.length;
  let code = "";
  while (code.length < recoveryCodeConfig.characterCount) {
    const random = crypto.getRandomValues(
      new Uint8Array(recoveryCodeConfig.characterCount),
    );
    for (const value of random) {
      if (value >= unbiasedLimit) continue;
      code += alphabet[value % alphabet.length];
      if (code.length === recoveryCodeConfig.characterCount) break;
    }
  }
  return formatRecoveryCode(code);
}
