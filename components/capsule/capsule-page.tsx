"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PinGate } from "@/components/capsule/pin-gate";
import { RecoveryFlow } from "@/components/capsule/recovery-flow";
import { PersistentMemoryFlow } from "@/components/capsule/persistent-memory-flow";
import { JournalHome } from "@/components/journal/journal-home";
import { JournalMemoryPage } from "@/components/journal/journal-memory-page";
import { JournalMobileShell } from "@/components/journal/journal-mobile-shell";
import {
  CAPSULE_OPEN_TIMEOUT_MS,
  logCapsuleOpenDiagnostic,
} from "@/lib/capsule/opening";
import {
  cacheAccessMemory,
  callCapsuleAccess,
  clearCapsuleSessionCache,
  ensureAnonymousSession,
  type CapsuleInspection,
} from "@/lib/capsule/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PersistentMemoryEntry } from "@/data/memory-demo";
import type { CapsuleProductType } from "@/data/journal";
import {
  journalThemeStyle,
  resolveJournalTheme,
  type JournalTheme,
} from "@/data/journal-themes";
import type { CapsuleInitialGate } from "@/lib/capsule/gate-state";

const CAPSULE_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;
const MAX_BROWSER_TIMER_MS = 2_147_000_000;

type PageState =
  | { type: "loading" }
  | { type: "notFound" }
  | { type: "unactivated"; client?: SupabaseClient }
  | { type: "locked"; client?: SupabaseClient }
  | {
      type: "unlocked";
      client: SupabaseClient;
      capsuleId: string;
      productType: CapsuleProductType;
      accessExpiresAt?: string;
      journalTheme?: JournalTheme;
      initialMemory?: PersistentMemoryEntry;
    }
  | { type: "error"; message: string };

function pageStateFromInitialGate(initialGate?: CapsuleInitialGate): PageState {
  if (!initialGate) return { type: "loading" };
  if (initialGate.type === "error") {
    return { type: "error", message: initialGate.message };
  }
  if (initialGate.type === "unavailable") {
    return {
      type: "error",
      message:
        "This memory capsule is unavailable. Please contact the maker if you believe this is a mistake.",
    };
  }
  if (initialGate.type === "locked") {
    return { type: "loading" };
  }
  return { type: initialGate.type };
}

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

export function CapsulePage({
  publicToken,
  memoryId,
  createIntent,
  initialGate,
  initialMonth,
}: {
  publicToken: string;
  memoryId?: string;
  createIntent?: "today" | "backfill";
  initialGate?: CapsuleInitialGate;
  initialMonth?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PageState>(() =>
    pageStateFromInitialGate(initialGate),
  );
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [leaseChecking, setLeaseChecking] = useState(false);
  const lastActivityTouchAt = useRef(0);

  const applyInspection = useCallback((
    client: SupabaseClient,
    inspection: CapsuleInspection,
  ) => {
    if (inspection.state === "notFound") setState({ type: "notFound" });
    else if (inspection.state === "unavailable") {
      setState({
        type: "error",
        message:
          "This memory capsule is unavailable. Please contact the maker if you believe this is a mistake.",
      });
    } else if (inspection.state === "unactivated") {
      setState({ type: "unactivated", client });
    } else if (inspection.state === "locked") {
      if (inspection.capsuleId) {
        clearCapsuleSessionCache(inspection.capsuleId);
      }
      setRecovering(false);
      setState({ type: "locked", client });
    } else if (inspection.capsuleId && inspection.productType) {
      lastActivityTouchAt.current = Date.now();
      setState({
        type: "unlocked",
        client,
        capsuleId: inspection.capsuleId,
        productType: inspection.productType,
        accessExpiresAt: inspection.accessExpiresAt,
        journalTheme: resolveJournalTheme(inspection.journalTheme),
        initialMemory: cacheAccessMemory(inspection.memory),
      });
    } else {
      setState({
        type: "error",
        message: "The capsule could not be opened.",
      });
    }
  }, []);

  const bootstrap = async () => {
    setState({ type: "loading" });
    try {
      const client = getSupabaseBrowserClient();
      await ensureAnonymousSession(client, CAPSULE_OPEN_TIMEOUT_MS);
      const inspection = await callCapsuleAccess(
        client,
        "inspect",
        publicToken,
        undefined,
        memoryId,
        CAPSULE_OPEN_TIMEOUT_MS,
      );
      applyInspection(client, inspection);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The capsule is temporarily unavailable.";
      logCapsuleOpenDiagnostic({
        stage: "inspect",
        code: error instanceof Error ? error.name : "UNKNOWN",
        origin: window.location.origin,
        message,
        memoryRoute: Boolean(memoryId),
      });
      setState({
        type: "error",
        message,
      });
    }
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const client = getSupabaseBrowserClient();
          await ensureAnonymousSession(client, CAPSULE_OPEN_TIMEOUT_MS);
          const inspection = await callCapsuleAccess(
            client,
            "inspect",
            publicToken,
            undefined,
            memoryId,
            CAPSULE_OPEN_TIMEOUT_MS,
          );
          if (active) applyInspection(client, inspection);
        } catch (error) {
          if (active) {
            const message =
              error instanceof Error
                ? error.message
                : "The capsule is temporarily unavailable.";
            logCapsuleOpenDiagnostic({
              stage: "inspect",
              code: error instanceof Error ? error.name : "UNKNOWN",
              origin: window.location.origin,
              message,
              memoryRoute: Boolean(memoryId),
            });
            setState({
              type: "error",
              message,
            });
          }
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [applyInspection, initialGate, memoryId, publicToken]);

  const submitPin = async (
    existingClient: SupabaseClient | undefined,
    action: "activate" | "unlock",
    pin: string,
  ) => {
    setGateBusy(true);
    setGateError("");
    try {
      const client = existingClient ?? getSupabaseBrowserClient();
      await ensureAnonymousSession(client, CAPSULE_OPEN_TIMEOUT_MS);
      const result = await callCapsuleAccess(
        client,
        action,
        publicToken,
        pin,
        memoryId,
      );
      if (result.ok && result.capsuleId) {
        const inspection = result.productType
          ? result
          : await callCapsuleAccess(
            client,
            "inspect",
            publicToken,
            undefined,
            memoryId,
            CAPSULE_OPEN_TIMEOUT_MS,
          );
        applyInspection(client, inspection);
      } else if (result.code === "TEMPORARILY_LOCKED") {
        setGateError("Too many attempts. Try again in about 15 minutes.");
      } else {
        setGateError("That PIN could not unlock this capsule.");
      }
    } catch {
      setGateError("The capsule service is temporarily unavailable. Please retry.");
    } finally {
      setGateBusy(false);
    }
  };

  const beginRecovery = async (existingClient: SupabaseClient | undefined) => {
    setGateBusy(true);
    setGateError("");
    try {
      const client = existingClient ?? getSupabaseBrowserClient();
      await ensureAnonymousSession(client, CAPSULE_OPEN_TIMEOUT_MS);
      setState({ type: "locked", client });
      setRecovering(true);
    } catch {
      setGateError("Recovery could not be opened. Please retry.");
    } finally {
      setGateBusy(false);
    }
  };

  useEffect(() => {
    if (
      state.type === "unlocked" &&
      state.productType === "bookmark" &&
      memoryId
    ) {
      router.replace(`/c/${publicToken}`);
    }
  }, [memoryId, publicToken, router, state]);

  useEffect(() => {
    if (state.type !== "unlocked") return;

    let active = true;
    let touchInFlight = false;
    let wasBackgrounded = document.visibilityState === "hidden";
    let expiryTimer: number | undefined;

    const locallyExpired = () => {
      const expiresAt = Date.parse(state.accessExpiresAt ?? "");
      return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    };

    const touchAccess = async ({
      force = false,
      mask = false,
    }: {
      force?: boolean;
      mask?: boolean;
    } = {}) => {
      const now = Date.now();
      const elapsed = now - lastActivityTouchAt.current;
      if (
        touchInFlight ||
        (!force && elapsed < CAPSULE_ACTIVITY_THROTTLE_MS)
      ) {
        return;
      }

      touchInFlight = true;
      lastActivityTouchAt.current = now;
      const shouldMask = mask || locallyExpired();
      if (shouldMask) setLeaseChecking(true);

      try {
        const inspection = await callCapsuleAccess(
          state.client,
          "touch",
          publicToken,
          undefined,
          undefined,
          CAPSULE_OPEN_TIMEOUT_MS,
        );
        if (!active) return;

        if (inspection.state === "unlocked") {
          setState((current) =>
            current.type === "unlocked"
              ? {
                  ...current,
                  accessExpiresAt:
                    inspection.accessExpiresAt ?? current.accessExpiresAt,
                }
              : current,
          );
          return;
        }

        applyInspection(state.client, inspection);
      } catch (error) {
        if (!active || !shouldMask) return;
        const message =
          error instanceof Error
            ? error.message
            : "The capsule is temporarily unavailable.";
        setState({ type: "error", message });
      } finally {
        touchInFlight = false;
        if (active) setLeaseChecking(false);
      }
    };

    const scheduleExpiryCheck = () => {
      const expiresAt = Date.parse(state.accessExpiresAt ?? "");
      if (!Number.isFinite(expiresAt)) return;

      const remaining = expiresAt - Date.now();
      const delay = Math.min(Math.max(remaining, 0), MAX_BROWSER_TIMER_MS);
      expiryTimer = window.setTimeout(() => {
        if (!active) return;
        if (Date.now() < expiresAt) {
          scheduleExpiryCheck();
          return;
        }
        void touchAccess({ force: true, mask: true });
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasBackgrounded = true;
        setLeaseChecking(true);
        return;
      }
      if (wasBackgrounded) {
        wasBackgrounded = false;
        void touchAccess({ force: true, mask: true });
      }
    };

    const handleFocus = () => {
      if (!wasBackgrounded) return;
      wasBackgrounded = false;
      void touchAccess({ force: true, mask: true });
    };

    const handleActivity = () => {
      void touchAccess();
    };

    scheduleExpiryCheck();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pointerdown", handleActivity, true);
    window.addEventListener("keydown", handleActivity, true);
    window.addEventListener("wheel", handleActivity, { capture: true, passive: true });

    return () => {
      active = false;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pointerdown", handleActivity, true);
      window.removeEventListener("keydown", handleActivity, true);
      window.removeEventListener("wheel", handleActivity, true);
    };
  }, [applyInspection, publicToken, state]);

  if (leaseChecking || state.type === "loading") {
    return (
      <main className="min-h-screen bg-leather p-8 text-center font-sans text-sm text-paper">
        Opening capsule…
      </main>
    );
  }
  if (state.type === "notFound") {
    return (
      <main className="min-h-screen bg-leather p-8 text-center font-sans text-sm text-paper">
        This capsule could not be found.
      </main>
    );
  }
  if (state.type === "error") {
    return (
      <main className="min-h-screen bg-leather p-8 text-center font-sans text-sm text-paper">
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => void bootstrap()}
          className="mt-4 font-semibold underline underline-offset-4"
        >
          Try again
        </button>
      </main>
    );
  }
  if (state.type === "unactivated") {
    return (
      <PinGate
        mode="activate"
        busy={gateBusy}
        error={gateError}
        onSubmit={(pin) => submitPin(state.client, "activate", pin)}
      />
    );
  }
  if (state.type === "locked") {
    if (recovering && state.client) {
      return (
        <RecoveryFlow
          client={state.client}
          publicToken={publicToken}
          onCancel={() => setRecovering(false)}
          onComplete={async (capsuleId) => {
            if (capsuleId) clearCapsuleSessionCache(capsuleId);
            setRecovering(false);
            await bootstrap();
          }}
        />
      );
    }
    return (
      <PinGate
        mode="unlock"
        busy={gateBusy}
        error={gateError}
        onSubmit={(pin) => submitPin(state.client, "unlock", pin)}
        onForgotPin={() => void beginRecovery(state.client)}
      />
    );
  }

  if (memoryId && !isUuid(memoryId)) {
    return (
      <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
        <div className="memory-entry mx-auto max-w-[36rem] text-center font-sans text-sm text-ink-soft">
          <p>This memory address is not valid.</p>
          <button
            type="button"
            onClick={() => router.replace(`/c/${publicToken}`)}
            className="mt-4 font-semibold text-oxblood underline underline-offset-4"
          >
            Back to journal
          </button>
        </div>
      </main>
    );
  }

  const lock = async () => {
    await callCapsuleAccess(state.client, "lock", publicToken);
    clearCapsuleSessionCache(state.capsuleId);
    setState({ type: "locked", client: state.client });
  };

  if (state.productType === "journal") {
    const theme = state.journalTheme ?? resolveJournalTheme();
    return (
      <main
        className="journal-mobile-page journal-themed-background"
        style={{
          ...journalThemeStyle(theme),
          background: theme.journalBackground,
          color: theme.textOnJournal,
        }}
      >
        <JournalMobileShell>
          {memoryId ? (
            <JournalMemoryPage
              client={state.client}
              capsuleId={state.capsuleId}
              publicToken={publicToken}
              memoryId={memoryId}
              createIntent={createIntent}
              theme={state.journalTheme}
              initialMemory={state.initialMemory}
              onLock={lock}
            />
          ) : (
            <JournalHome
              client={state.client}
              capsuleId={state.capsuleId}
              publicToken={publicToken}
              initialMonth={initialMonth}
              onLock={lock}
            />
          )}
        </JournalMobileShell>
      </main>
    );
  }

  if (memoryId) {
    return (
      <main className="min-h-screen bg-leather p-8 text-center font-sans text-sm text-paper">
        Opening memory…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[36rem]">
        <PersistentMemoryFlow
          client={state.client}
          capsuleId={state.capsuleId}
          publicToken={publicToken}
          initialMemory={state.initialMemory}
          onLock={lock}
        />
      </div>
    </main>
  );
}
