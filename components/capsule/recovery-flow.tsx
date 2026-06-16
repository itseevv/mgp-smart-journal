"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatRecoveryCode,
  isCompleteRecoveryCode,
} from "@/lib/recovery/config";
import {
  inspectRecoveryAccess,
  replaceLostRecoveryCode,
  resetOwnerPinWithRecovery,
  verifyRecoveryCode,
} from "@/lib/capsule/api";

type RecoveryStep =
  | "checking"
  | "unavailable"
  | "error"
  | "code"
  | "verifyingCode"
  | "pin"
  | "submitting"
  | "responseLost"
  | "success";

export function RecoveryFlow({
  client,
  publicToken,
  onCancel,
  onComplete,
}: {
  client: SupabaseClient;
  publicToken: string;
  onCancel: () => void;
  onComplete: (capsuleId?: string) => Promise<void>;
}) {
  const [step, setStep] = useState<RecoveryStep>("checking");
  const [operationId] = useState(() => crypto.randomUUID());
  const [recoveryCode, setRecoveryCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState("");
  const [capsuleId, setCapsuleId] = useState<string>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const checkRecovery = useCallback(async () => {
    setError("");
    setStep("checking");
    try {
      const result = await inspectRecoveryAccess(client, publicToken);
      if (!result.ok) {
        setError("Recovery could not be opened. Please retry.");
        setStep("error");
      } else {
        setStep(result.recoveryEnabled ? "code" : "unavailable");
      }
    } catch {
      setError("Recovery could not be opened. Please retry.");
      setStep("error");
    }
  }, [client, publicToken]);

  useEffect(() => {
    let active = true;
    void inspectRecoveryAccess(client, publicToken)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError("Recovery could not be opened. Please retry.");
          setStep("error");
        } else {
          setStep(result.recoveryEnabled ? "code" : "unavailable");
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Recovery could not be opened. Please retry.");
        setStep("error");
      });
    return () => {
      active = false;
    };
  }, [client, publicToken]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const continueToPin = async (event: FormEvent) => {
    event.preventDefault();
    if (!isCompleteRecoveryCode(recoveryCode)) {
      setError("Enter the complete Recovery Passcode.");
      return;
    }
    setError("");
    setStep("verifyingCode");
    try {
      const result = await verifyRecoveryCode(
        client,
        publicToken,
        recoveryCode,
      );
      if (result.ok) {
        setStep("pin");
      } else if (result.code === "RECOVERY_NOT_ENABLED") {
        setStep("unavailable");
      } else {
        setError(
          result.code === "TEMPORARILY_LOCKED"
            ? "Recovery is temporarily unavailable after several unsuccessful attempts. Please try again later."
            : "The Recovery Passcode could not be verified.",
        );
        setStep("code");
      }
    } catch {
      setError("The Recovery Passcode could not be verified. Please retry.");
      setStep("code");
    }
  };

  const submitReset = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter exactly six digits.");
      return;
    }
    if (pin !== confirmation) {
      setError("The two PIN entries do not match.");
      return;
    }
    setError("");
    setStep("submitting");
    try {
      const result = await resetOwnerPinWithRecovery(client, {
        publicToken,
        operationId,
        recoveryCode,
        pin,
        pinConfirmation: confirmation,
      });
      if (result.ok && result.recoveryCode) {
        setNewRecoveryCode(result.recoveryCode);
        setCapsuleId(result.capsuleId);
        setStep("success");
      } else if (
        result.ok &&
        result.status === "completed" &&
        result.replacementAvailable
      ) {
        setStep("responseLost");
      } else if (result.code === "RECOVERY_NOT_ENABLED") {
        setStep("unavailable");
      } else {
        setError(
          result.code === "TEMPORARILY_LOCKED"
            ? "Recovery is temporarily unavailable after several unsuccessful attempts. Please try again later."
            : "The Recovery Passcode could not be verified.",
        );
        setStep("code");
      }
    } catch {
      setError(
        "The response was interrupted. Retry safely with the same recovery request.",
      );
      setStep("pin");
    }
  };

  const replaceCode = async () => {
    setError("");
    setStep("submitting");
    try {
      const result = await replaceLostRecoveryCode(
        client,
        publicToken,
        operationId,
      );
      if (result.ok && result.recoveryCode) {
        setNewRecoveryCode(result.recoveryCode);
        setStep("success");
      } else {
        setError(
          "A replacement Recovery Passcode is no longer available for this request.",
        );
        setStep("responseLost");
      }
    } catch {
      setError("The replacement request could not be completed. Please retry.");
      setStep("responseLost");
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(newRecoveryCode);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Select and copy");
    }
  };

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <article className="memory-entry mx-auto max-w-[36rem]">
        <button
          type="button"
          onClick={onCancel}
          disabled={step === "submitting"}
          className="font-sans text-xs font-semibold text-ink-soft underline underline-offset-4 disabled:opacity-40"
        >
          Back to PIN
        </button>

        {step === "checking" ? (
          <p className="mt-8 font-sans text-sm text-ink-soft" role="status">
            Checking recovery…
          </p>
        ) : null}

        {step === "unavailable" ? (
          <>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-6 font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Recovery is not enabled
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              This journal does not currently have a Recovery Passcode. A
              future support process can issue one after ownership is verified.
            </p>
          </>
        ) : null}

        {step === "error" ? (
          <>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-6 font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Recovery is temporarily unavailable
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              The recovery service could not be reached. Your journal has not
              been changed.
            </p>
            <p className="mt-4 font-sans text-xs text-oxblood" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void checkRecovery()}
              className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper"
            >
              Try again
            </button>
          </>
        ) : null}

        {step === "code" ? (
          <form onSubmit={continueToPin} className="mt-6">
            <p className="font-sans text-xs font-semibold tracking-[0.08em] text-oxblood">
              Owner PIN recovery
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-5 font-serif text-[2.7rem] leading-[0.98] tracking-[-0.04em] outline-none"
            >
              Enter your Recovery Passcode
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              This is the backup code issued with your journal.
            </p>
            <label className="mt-8 block">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Recovery Passcode
              </span>
              <input
                value={recoveryCode}
                onChange={(event) =>
                  setRecoveryCode(formatRecoveryCode(event.target.value))
                }
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Recovery Passcode"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="mt-2 w-full border-0 border-b border-rule bg-transparent pb-3 font-sans text-lg tracking-[0.08em] outline-none placeholder:text-ink-soft/45 focus:border-oxblood"
              />
            </label>
            {error ? (
              <p className="mt-4 font-sans text-xs text-oxblood" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper"
            >
              Continue to new PIN
            </button>
          </form>
        ) : null}

        {step === "pin" ? (
          <form onSubmit={submitReset} className="mt-6">
            <p className="font-sans text-xs font-semibold tracking-[0.08em] text-oxblood">
              Owner PIN recovery
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-5 font-serif text-[2.7rem] leading-[0.98] tracking-[-0.04em] outline-none"
            >
              Create a new PIN
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              Choose six digits. Your Recovery Passcode will be verified when
              you submit the reset, and previous devices will lose access only
              if it succeeds.
            </p>
            <label className="mt-8 block">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                New Owner PIN
              </span>
              <input
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="off"
                aria-label="New Owner PIN"
                className="mt-2 w-full border-0 border-b border-rule bg-transparent pb-3 font-sans text-3xl tracking-[0.35em] outline-none focus:border-oxblood"
              />
            </label>
            <label className="mt-6 block">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Confirm new PIN
              </span>
              <input
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                inputMode="numeric"
                autoComplete="off"
                aria-label="Confirm new Owner PIN"
                className="mt-2 w-full border-0 border-b border-rule bg-transparent pb-3 font-sans text-3xl tracking-[0.35em] outline-none focus:border-oxblood"
              />
            </label>
            {error ? (
              <p className="mt-4 font-sans text-xs text-oxblood" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper"
            >
              Verify passcode and reset PIN
            </button>
          </form>
        ) : null}

        {step === "submitting" ? (
          <div className="mt-8" aria-live="polite">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Securing your journal…
            </h1>
            <p className="mt-4 font-sans text-sm text-ink-soft">
              Keep this page open while access is reset.
            </p>
          </div>
        ) : null}

        {step === "verifyingCode" ? (
          <div className="mt-8" aria-live="polite">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Checking passcode…
            </h1>
            <p className="mt-4 font-sans text-sm text-ink-soft">
              Keep this page open for a moment.
            </p>
          </div>
        ) : null}

        {step === "responseLost" ? (
          <div className="mt-8">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Your PIN was reset
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              The original success response was interrupted, so its new
              Recovery Passcode cannot be shown. You can replace it once within
              this recovery window.
            </p>
            {error ? (
              <p className="mt-4 font-sans text-xs text-oxblood" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void replaceCode()}
              className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper"
            >
              Generate one replacement code
            </button>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="mt-8">
            <p className="font-sans text-xs font-semibold tracking-[0.08em] text-oxblood">
              Save this now
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-5 font-serif text-[2.5rem] leading-none tracking-[-0.04em] outline-none"
            >
              Your new Recovery Passcode
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-ink-soft">
              Your previous recovery code no longer works. Save this new code
              somewhere safe.
            </p>
            <div className="mt-7 border-y border-rule py-5 text-center">
              <code className="font-sans text-lg font-semibold tracking-[0.08em] text-ink">
                {newRecoveryCode}
              </code>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="mt-4 block w-full font-sans text-xs font-semibold text-oxblood underline underline-offset-4"
              >
                {copyLabel}
              </button>
            </div>
            <label className="mt-6 flex items-start gap-3 font-sans text-sm leading-5 text-ink-soft">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1 accent-oxblood"
              />
              <span>I have saved my new Recovery Passcode</span>
            </label>
            <button
              type="button"
              disabled={!acknowledged}
              onClick={() => void onComplete(capsuleId)}
              className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper disabled:opacity-40"
            >
              Continue to journal
            </button>
          </div>
        ) : null}
      </article>
    </main>
  );
}
