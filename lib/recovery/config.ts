export const recoveryCodeConfig = {
  alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  characterCount: 16,
  groupCount: 4,
  groupSize: 4,
  hashVersion: 1,
  sessionFailureLimit: 5,
  sessionLockoutMinutes: 30,
  capsuleFailureLimit: 20,
  capsuleFailureWindowHours: 24,
  capsuleLockoutMinutes: 60,
  replacementWindowMinutes: 30,
} as const;

const allowedCharacters = new Set(recoveryCodeConfig.alphabet);

export function normalizeRecoveryCode(value: string) {
  return [...value.toUpperCase()]
    .filter((character) => allowedCharacters.has(character))
    .slice(0, recoveryCodeConfig.characterCount)
    .join("");
}

export function formatRecoveryCode(value: string) {
  const normalized = normalizeRecoveryCode(value);
  const groups: string[] = [];
  for (
    let index = 0;
    index < normalized.length;
    index += recoveryCodeConfig.groupSize
  ) {
    groups.push(normalized.slice(index, index + recoveryCodeConfig.groupSize));
  }
  return groups.join("-");
}

export function isCompleteRecoveryCode(value: string) {
  return normalizeRecoveryCode(value).length === recoveryCodeConfig.characterCount;
}
