export type CapsuleInitialGate =
  | { type: "notFound" }
  | { type: "unavailable" }
  | { type: "unactivated" }
  | { type: "locked" }
  | { type: "error"; message: string };
