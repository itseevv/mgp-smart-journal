import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.",
  );
}

const token = randomBytes(24).toString("hex");
const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client
  .from("capsules")
  .insert({
    public_token: token,
    product_type: process.argv.includes("--journal") ? "journal" : "bookmark",
    status: "unactivated",
  })
  .select("id,public_token,product_type,status")
  .single();

if (error) throw error;
const output = {
  capsule: data,
  localUrl: `http://localhost:3000/c/${token}`,
};

if (process.argv.includes("--recovery")) {
  console.error(
    "DEVELOPMENT ONLY: the generated Recovery Passcode will be printed once.",
  );
  const response = await fetch(`${url}/functions/v1/capsule-access`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "issue-recovery-code",
      publicToken: token,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok || typeof result.recoveryCode !== "string") {
    throw new Error(
      `Capsule ${data.id} was created, but recovery issuance failed with code ${
        result.code ?? response.status
      }.`,
    );
  }
  output.developmentRecoveryCode = result.recoveryCode;
}

console.log(JSON.stringify(output, null, 2));
