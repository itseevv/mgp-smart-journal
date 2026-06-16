const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before issuing a recovery code.",
  );
}

const tokenIndex = process.argv.indexOf("--token");
const capsuleIdIndex = process.argv.indexOf("--capsule-id");
const publicToken = tokenIndex >= 0 ? process.argv[tokenIndex + 1] : undefined;
const capsuleId =
  capsuleIdIndex >= 0 ? process.argv[capsuleIdIndex + 1] : undefined;

if ((!publicToken && !capsuleId) || (publicToken && capsuleId)) {
  throw new Error(
    "Provide exactly one capsule identifier: --token PUBLIC_TOKEN or --capsule-id UUID.",
  );
}
if (
  capsuleId &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    capsuleId,
  )
) {
  throw new Error("--capsule-id must be a valid UUID.");
}

const response = await fetch(`${url}/functions/v1/capsule-access`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "issue-recovery-code",
    publicToken,
    capsuleId,
  }),
});
const result = await response.json();
if (!response.ok || !result.ok || typeof result.recoveryCode !== "string") {
  throw new Error(
    `Recovery issuance failed with code ${result.code ?? response.status}.`,
  );
}

console.log("DEVELOPMENT-ONLY RECOVERY PASSCODE");
console.log("Store this value securely. It will not be shown again.");
console.log(result.recoveryCode);
console.log(`Capsule ID: ${result.capsuleId}`);
console.log(`Code version: ${result.codeVersion}`);
