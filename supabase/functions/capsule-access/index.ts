import { createClient } from "npm:@supabase/supabase-js@2";

import {
  isCompleteRecoveryCode,
  recoveryCodeConfig,
} from "../../../lib/recovery/config.ts";
import {
  generateRecoveryCode,
  recoveryCodeHash,
} from "../_shared/recovery.ts";

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOrigins() {
  const configured = new Set<string>();
  for (const value of [
    Deno.env.get("ALLOWED_ORIGIN"),
    Deno.env.get("APP_BASE_URL"),
    ...String(Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ]) {
    const origin = normalizeOrigin(value);
    if (origin) configured.add(origin);
  }
  return configured;
}

function corsHeaders(origin?: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const normalizedOrigin = normalizeOrigin(origin);
  if (normalizedOrigin && allowedOrigins().has(normalizedOrigin)) {
    headers["Access-Control-Allow-Origin"] = normalizedOrigin;
  }
  return headers;
}

function json(body: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function verifiedJwtClaims(authorization: string) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return undefined;
  const payloadSegment = match[1].split(".")[1];
  if (!payloadSegment) return undefined;
  try {
    const payload = JSON.parse(
      atob(
        payloadSegment
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "="),
      ),
    ) as { sub?: unknown; role?: unknown };
    return {
      userId: typeof payload.sub === "string" ? payload.sub : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return undefined;
  }
}

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

async function invokeRecoveryRpcWithGeneratedCode(
  admin: ReturnType<typeof createClient>,
  rpcName: string,
  params: Record<string, unknown>,
  pepper: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const recoveryCode = generateRecoveryCode();
    const newHash = await recoveryCodeHash(recoveryCode, pepper);
    const result = await admin.rpc(rpcName, {
      ...params,
      requested_new_code_hash_hex: newHash,
      requested_hash_version: recoveryCodeConfig.hashVersion,
    });
    if (!result.error) return { data: result.data, recoveryCode };
    if (result.error.code !== "23505") throw result.error;
  }
  throw new Error("Recovery code generation collision.");
}

async function loadUnlockedMemory(
  admin: ReturnType<typeof createClient>,
  capsuleId: string,
  memoryId?: string,
) {
  let query = admin
    .from("memories")
    .select(
      "id,capsule_id,title,occurred_at,local_date,local_timezone,photos(*),voice_memos(*)",
    )
    .eq("capsule_id", capsuleId);
  query = memoryId
    ? query.eq("id", memoryId)
    : query.order("created_at", { ascending: true }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const photos = [...(data.photos ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const voiceMemos = [...(data.voice_memos ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  let firstPhotoUrl: string | undefined;
  if (photos[0]?.storage_path) {
    const signed = await admin.storage
      .from("memory-media")
      .createSignedUrl(photos[0].storage_path, 600);
    if (signed.error) throw signed.error;
    firstPhotoUrl = signed.data.signedUrl;
  }

  return {
    id: data.id,
    capsuleId: data.capsule_id,
    title: data.title,
    capturedAt: data.occurred_at,
    localDate: data.local_date ?? undefined,
    localTimezone: data.local_timezone ?? null,
    photos: photos.map((photo, index) => ({
      id: photo.id,
      name: `Photograph ${photo.order_index + 1}`,
      objectUrl: index === 0 ? firstPhotoUrl : undefined,
      storagePath: photo.storage_path,
      sizeBytes: photo.size_bytes,
      mimeType: photo.mime_type,
      width: photo.width,
      height: photo.height,
      thumbnailStoragePath: photo.thumbnail_storage_path,
      thumbnailSizeBytes: photo.thumbnail_size_bytes,
      thumbnailMimeType: photo.thumbnail_mime_type,
      thumbnailWidth: photo.thumbnail_width,
      thumbnailHeight: photo.thumbnail_height,
      isLegacyThumbnail: !photo.thumbnail_storage_path,
      cropMetadata: photo.crop_metadata ?? undefined,
      status: "persisted",
    })),
    voiceMemos: voiceMemos.map((memo) => ({
      id: memo.id,
      title: memo.title,
      durationSeconds: memo.duration_seconds,
      storagePath: memo.storage_path,
      mimeType: memo.mime_type,
      sizeBytes: memo.size_bytes,
      createdAt: memo.created_at,
      order: memo.order_index,
      status: "persisted",
    })),
  };
}

async function processCleanup(
  admin: ReturnType<typeof createClient>,
  capsuleId: string,
  requestedPaths: string[],
) {
  const validPrefix = `capsules/${capsuleId}/`;
  if (requestedPaths.some((path) => !path.startsWith(validPrefix))) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  if (requestedPaths.length > 0) {
    const rows = requestedPaths.map((storagePath) => ({
      capsule_id: capsuleId,
      storage_path: storagePath,
      status: "pending",
      last_error: null,
    }));
    const queued = await admin
      .from("media_cleanup_queue")
      .upsert(rows, { onConflict: "storage_path" });
    if (queued.error) throw queued.error;
  }

  const queued = await admin
    .from("media_cleanup_queue")
    .select("id,storage_path,attempts")
    .eq("capsule_id", capsuleId)
    .in("status", ["pending", "failed"])
    .order("created_at")
    .limit(100);
  if (queued.error) throw queued.error;
  if (!queued.data.length) return { ok: true, remaining: 0 };

  const removal = await admin.storage
    .from("memory-media")
    .remove(queued.data.map((item) => item.storage_path));
  if (removal.error) {
    await Promise.all(
      queued.data.map((item) =>
        admin
          .from("media_cleanup_queue")
          .update({
            status: "failed",
            attempts: item.attempts + 1,
            last_error: removal.error.message.slice(0, 500),
          })
          .eq("id", item.id),
      ),
    );
  } else {
    const deleted = await admin
      .from("media_cleanup_queue")
      .delete()
      .in("id", queued.data.map((item) => item.id));
    if (deleted.error) throw deleted.error;
  }

  const remaining = await admin
    .from("media_cleanup_queue")
    .select("id", { count: "exact", head: true })
    .eq("capsule_id", capsuleId);
  if (remaining.error) throw remaining.error;
  return {
    ok: !removal.error,
    remaining: remaining.count ?? 0,
  };
}

async function isCapsuleDisabled(
  admin: ReturnType<typeof createClient>,
  publicToken: string | undefined,
) {
  if (!publicToken) return true;
  const capsule = await admin
    .from("capsules")
    .select("id,capsule_fulfillment(fulfillment_status)")
    .eq("public_token", publicToken)
    .maybeSingle();
  if (capsule.error || !capsule.data) return true;
  const fulfillment = capsule.data.capsule_fulfillment as
    | { fulfillment_status?: string }
    | Array<{ fulfillment_status?: string }>
    | null;
  return Array.isArray(fulfillment)
    ? fulfillment.some((item) => item.fulfillment_status === "disabled")
    : fulfillment?.fulfillment_status === "disabled";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const requestCorsHeaders = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    if (origin && !requestCorsHeaders["Access-Control-Allow-Origin"]) {
      return new Response("forbidden", {
        status: 403,
        headers: requestCorsHeaders,
      });
    }
    return new Response("ok", { headers: requestCorsHeaders });
  }
  if (request.method !== "POST") {
    return json({ ok: false, code: "INVALID_REQUEST" }, 405, origin);
  }
  if (origin && !requestCorsHeaders["Access-Control-Allow-Origin"]) {
    return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const recoveryPepper = Deno.env.get("RECOVERY_CODE_PEPPER_V1");
  if (!url || !serviceKey) return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);

  const authorization = request.headers.get("Authorization") ?? "";
  // Supabase's gateway verifies this JWT before invoking the function because
  // verify_jwt is enabled in config.toml. Decode only the verified subject here
  // to avoid a second Auth network request on every access action.
  const claims = verifiedJwtClaims(authorization);
  if (!claims) return json({ ok: false, code: "UNAVAILABLE" }, 401, origin);
  const userId = claims.userId;

  let input: {
    action?: string;
    publicToken?: string;
    pin?: string;
    pinConfirmation?: string;
    memoryId?: string;
    cleanupPaths?: string[];
    recoveryCode?: string;
    operationId?: string;
    capsuleId?: string;
  };
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
  }
  if (
    ![
      "inspect",
      "activate",
      "unlock",
      "lock",
      "cleanup",
      "recovery-inspect",
      "recovery-verify",
      "recovery-reset",
      "recovery-replace",
      "issue-recovery-code",
    ].includes(
      input.action ?? "",
    )
  ) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
  }
  if (
    input.action !== "issue-recovery-code" &&
    !input.publicToken
  ) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
  }
  if ((input.action === "activate" || input.action === "unlock") && !/^\d{6}$/.test(input.pin ?? "")) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  if (input.action === "issue-recovery-code") {
    if (
      claims.role !== "service_role" ||
      !recoveryPepper ||
      (!input.publicToken && !input.capsuleId) ||
      (input.publicToken && input.capsuleId) ||
      (input.capsuleId && !isUuid(input.capsuleId))
    ) {
      return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
    }
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const recoveryCode = generateRecoveryCode();
        const codeHash = await recoveryCodeHash(recoveryCode, recoveryPepper);
        const issued = await admin.rpc("issue_capsule_recovery_code", {
          requested_token: input.publicToken ?? null,
          requested_capsule_id: input.capsuleId ?? null,
          requested_code_hash_hex: codeHash,
          requested_hash_version: recoveryCodeConfig.hashVersion,
        });
        if (!issued.error) {
          return json({
            ...issued.data,
            recoveryCode,
          }, 200, origin);
        }
        if (issued.error.code !== "23505") throw issued.error;
      }
      throw new Error("Recovery code generation collision.");
    } catch (issueError) {
      console.error(
        "capsule-access recovery issuance failed",
        issueError instanceof Error ? issueError.name : "unknown",
      );
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
  }

  if (!userId) return json({ ok: false, code: "UNAVAILABLE" }, 401, origin);

  if (input.action === "recovery-inspect") {
    if (await isCapsuleDisabled(admin, input.publicToken)) {
      return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
    }
    const inspected = await admin.rpc("inspect_capsule_recovery", {
      requested_token: input.publicToken,
    });
    if (inspected.error) {
      console.error("capsule-access recovery inspection failed", inspected.error.code);
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
    return json(inspected.data, 200, origin);
  }

  if (input.action === "recovery-verify") {
    if (
      !recoveryPepper ||
      !isCompleteRecoveryCode(input.recoveryCode ?? "")
    ) {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
    }
    try {
      if (await isCapsuleDisabled(admin, input.publicToken)) {
        return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
      }
      const codeHash = await recoveryCodeHash(
        input.recoveryCode ?? "",
        recoveryPepper,
      );
      const verified = await admin.rpc("verify_capsule_recovery_code", {
        requested_token: input.publicToken,
        requested_user: userId,
        requested_code_hash_hex: codeHash,
      });
      if (verified.error) throw verified.error;
      return json(verified.data, 200, origin);
    } catch (verifyError) {
      console.error(
        "capsule-access recovery verify failed",
        verifyError instanceof Error ? verifyError.name : "unknown",
      );
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
  }

  if (input.action === "recovery-reset") {
    if (
      !recoveryPepper ||
      !isUuid(input.operationId) ||
      !isCompleteRecoveryCode(input.recoveryCode ?? "") ||
      !/^\d{6}$/.test(input.pin ?? "") ||
      input.pin !== input.pinConfirmation
    ) {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
    }
    try {
      if (await isCapsuleDisabled(admin, input.publicToken)) {
        return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
      }
      const currentHash = await recoveryCodeHash(
        input.recoveryCode ?? "",
        recoveryPepper,
      );
      const reset = await invokeRecoveryRpcWithGeneratedCode(
        admin,
        "reset_capsule_owner_with_recovery",
        {
          requested_token: input.publicToken,
          requested_user: userId,
          requested_operation_id: input.operationId,
          requested_code_hash_hex: currentHash,
          requested_new_pin: input.pin,
        },
        recoveryPepper,
      );
      if (!reset.data?.ok || reset.data?.duplicate) {
        return json(reset.data, 200, origin);
      }
      return json({
        ...reset.data,
        recoveryCode: reset.recoveryCode,
      }, 200, origin);
    } catch (resetError) {
      console.error(
        "capsule-access recovery reset failed",
        resetError instanceof Error ? resetError.name : "unknown",
      );
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
  }

  if (input.action === "recovery-replace") {
    if (!recoveryPepper || !isUuid(input.operationId)) {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400, origin);
    }
    try {
      if (await isCapsuleDisabled(admin, input.publicToken)) {
        return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
      }
      const replacement = await invokeRecoveryRpcWithGeneratedCode(
        admin,
        "replace_lost_recovery_code",
        {
          requested_token: input.publicToken,
          requested_user: userId,
          requested_operation_id: input.operationId,
        },
        recoveryPepper,
      );
      if (!replacement.data?.ok || replacement.data?.duplicate) {
        return json(replacement.data, 200, origin);
      }
      return json({
        ...replacement.data,
        recoveryCode: replacement.recoveryCode,
      }, 200, origin);
    } catch (replaceError) {
      console.error(
        "capsule-access recovery replacement failed",
        replaceError instanceof Error ? replaceError.name : "unknown",
      );
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
  }

  if (input.action === "cleanup") {
    const inspected = await admin.rpc("inspect_capsule_access", {
      requested_token: input.publicToken,
      requested_user: userId,
    });
    if (
      inspected.error ||
      inspected.data?.state !== "unlocked" ||
      typeof inspected.data?.capsuleId !== "string"
    ) {
      return json({ ok: false, code: "ACCESS_DENIED" }, 403, origin);
    }
    try {
      return json(
        await processCleanup(
          admin,
          inspected.data.capsuleId,
          Array.isArray(input.cleanupPaths)
            ? input.cleanupPaths.filter(
                (path): path is string => typeof path === "string",
              )
            : [],
        ),
        200,
        origin,
      );
    } catch (cleanupError) {
      console.error(
        "capsule-access cleanup failed",
        cleanupError instanceof Error ? cleanupError.name : "unknown",
      );
      return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
    }
  }

  const rpcName = {
    inspect: "inspect_capsule_access",
    activate: "activate_capsule_owner",
    unlock: "unlock_capsule_owner",
    lock: "lock_capsule_owner",
  }[input.action!]!;
  const params: Record<string, string> = {
    requested_token: input.publicToken,
    requested_user: userId,
  };
  if (input.pin) params.requested_pin = input.pin;
  const { data, error } = await admin.rpc(rpcName, params);
  if (error) {
    console.error("capsule-access rpc failed", error.code);
    return json({ ok: false, code: "UNAVAILABLE" }, 503, origin);
  }
  const capsuleId =
    typeof data?.capsuleId === "string" ? data.capsuleId : undefined;
  const isUnlocked =
    data?.state === "unlocked" ||
    ((input.action === "activate" || input.action === "unlock") &&
      data?.ok === true);
  if (!capsuleId || !isUnlocked) return json(data, 200, origin);

  try {
    const capsule = await admin
      .from("capsules")
      .select("product_type")
      .eq("id", capsuleId)
      .single();
    if (capsule.error) throw capsule.error;
    const productType = capsule.data.product_type;
    return json({
      ...data,
      productType,
      memory:
        productType === "bookmark" || input.memoryId
          ? await loadUnlockedMemory(admin, capsuleId, input.memoryId)
          : undefined,
    }, 200, origin);
  } catch (memoryError) {
    console.error(
      "capsule-access memory load failed",
      memoryError instanceof Error ? memoryError.name : "unknown",
    );
    return json({ ...data, memoryUnavailable: true }, 200, origin);
  }
});
