"use client";

import { useCallback, useEffect, useState } from "react";

function readMonthQuery() {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("month") ?? undefined;
}

function updateMonthQuery(monthKey: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("month", monthKey);
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function useMonthQueryState(initialMonth?: string) {
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);

  useEffect(() => {
    const handlePopState = () => setRequestedMonth(readMonthQuery());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectMonth = useCallback((monthKey: string) => {
    updateMonthQuery(monthKey);
    setRequestedMonth(monthKey);
  }, []);

  return [requestedMonth, selectMonth] as const;
}
