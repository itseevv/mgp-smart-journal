"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  JournalActionTray,
  JournalActionTrayOption,
  JournalPrimaryCTA,
} from "@/components/journal/journal-visual-primitives";

type BottomRitualActionProps = {
  busy?: boolean;
  todaySealed: boolean;
  todayActionDisabled?: boolean;
  backfillDisabled?: boolean;
  onTodayAction: () => void;
  onBackfillAction: () => void;
};

export function BottomRitualAction({
  busy = false,
  todaySealed,
  todayActionDisabled = false,
  backfillDisabled = false,
  onTodayAction,
  onBackfillAction,
}: BottomRitualActionProps) {
  const [trayOpen, setTrayOpen] = useState(false);
  const trayId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const todayLabel = todaySealed ? "Today's Stamp" : "Seal Today";
  const mainDisabled = busy || (todayActionDisabled && backfillDisabled);

  useEffect(() => {
    if (!trayOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current?.contains(target)
      ) {
        return;
      }
      setTrayOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrayOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [trayOpen]);

  const choose = (action: () => void) => {
    setTrayOpen(false);
    action();
  };

  return (
    <div
      className="journal-bottom-ritual-action"
      data-journal-home-bottom-cta="seal-the-day"
      data-seal-the-day-tray-state={trayOpen ? "open" : "closed"}
      data-seal-the-day-default-label="Seal the Day"
      ref={containerRef}
    >
      <div className="journal-bottom-ritual-action__inner">
        {trayOpen ? (
          <JournalActionTray
            id={trayId}
            role="menu"
            aria-label="Seal the Day options"
            className="journal-bottom-ritual-action__tray"
            data-seal-the-day-tray="contextual-menu"
            data-seal-the-day-tray-visual="approved-playground"
            data-seal-the-day-today-state={
              todaySealed ? "today-sealed" : "today-open"
            }
          >
            <JournalActionTrayOption
              type="button"
              role="menuitem"
              onClick={() => choose(onTodayAction)}
              disabled={busy || todayActionDisabled}
              className="journal-bottom-ritual-action__tray-option"
              data-seal-the-day-option={
                todaySealed ? "todays-stamp" : "seal-today"
              }
            >
              {todayLabel}
            </JournalActionTrayOption>
            <JournalActionTrayOption
              type="button"
              role="menuitem"
              onClick={() => choose(onBackfillAction)}
              disabled={busy || backfillDisabled}
              className="journal-bottom-ritual-action__tray-option journal-bottom-ritual-action__tray-option--secondary"
              secondary
              data-seal-the-day-option="seal-another-day"
            >
              Seal Another Day
            </JournalActionTrayOption>
          </JournalActionTray>
        ) : null}
        <JournalPrimaryCTA
          type="button"
          onClick={() => setTrayOpen((current) => !current)}
          disabled={mainDisabled}
          aria-busy={busy}
          aria-expanded={trayOpen}
          aria-controls={trayId}
          aria-haspopup="menu"
          className="journal-bottom-ritual-action__button journal-primary-bottom-cta"
          data-seal-today-treatment="bottom-sticky"
          data-seal-today-label="Seal the Day"
          data-seal-the-day-treatment="bottom-sticky-tray"
          data-seal-the-day-cta-visual="approved-playground-button"
        >
          Seal the Day
        </JournalPrimaryCTA>
      </div>
    </div>
  );
}
