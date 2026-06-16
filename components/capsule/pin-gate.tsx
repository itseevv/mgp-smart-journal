"use client";

import { useState, type FormEvent } from "react";

type PinGateProps = {
  mode: "activate" | "unlock";
  busy: boolean;
  error: string;
  onSubmit: (pin: string) => Promise<void>;
  onForgotPin?: () => void;
};

export function PinGate({
  mode,
  busy,
  error,
  onSubmit,
  onForgotPin,
}: PinGateProps) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setLocalError("Enter exactly six digits.");
      return;
    }
    if (mode === "activate" && pin !== confirmation) {
      setLocalError("The two PIN entries do not match.");
      return;
    }
    setLocalError("");
    await onSubmit(pin);
  };

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <article className="memory-entry mx-auto max-w-[36rem]">
        <p className="font-sans text-xs font-semibold tracking-[0.08em] text-oxblood">
          {mode === "activate" ? "Activate this journal" : "Private memory"}
        </p>
        <h1 className="mt-5 max-w-[11ch] font-serif text-[3rem] leading-[0.98] tracking-[-0.05em]">
          {mode === "activate" ? "Create your Owner PIN" : "Unlock this memory"}
        </h1>
        <p className="mt-4 max-w-md font-sans text-sm leading-6 text-ink-soft">
          {mode === "activate"
            ? "Choose six digits you will use when opening this capsule on another device."
            : "Enter the six-digit Owner PIN for this capsule."}
        </p>
        <form onSubmit={submit} className="mt-8">
          <label className="block">
            <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              Owner PIN
            </span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Owner PIN"
              className="mt-2 w-full border-0 border-b border-rule bg-transparent pb-3 font-sans text-3xl tracking-[0.35em] outline-none focus:border-oxblood"
            />
          </label>
          {mode === "activate" ? (
            <label className="mt-6 block">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Confirm PIN
              </span>
              <input
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="off"
                aria-label="Confirm Owner PIN"
                className="mt-2 w-full border-0 border-b border-rule bg-transparent pb-3 font-sans text-3xl tracking-[0.35em] outline-none focus:border-oxblood"
              />
            </label>
          ) : null}
          {localError || error ? (
            <p className="mt-4 font-sans text-xs text-oxblood" role="alert">
              {localError || error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-7 w-full rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper disabled:opacity-50"
          >
            {busy
              ? mode === "activate"
                ? "Activating securely…"
                : "Unlocking securely…"
              : mode === "activate"
                ? "Activate journal"
                : "Unlock memory"}
          </button>
          {mode === "unlock" && onForgotPin ? (
            <button
              type="button"
              onClick={onForgotPin}
              disabled={busy}
              className="mx-auto mt-5 block font-sans text-xs font-semibold text-ink-soft underline underline-offset-4 disabled:opacity-40"
            >
              Forgot PIN?
            </button>
          ) : null}
        </form>
      </article>
    </main>
  );
}
