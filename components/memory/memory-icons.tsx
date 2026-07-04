type IconProps = {
  className?: string;
};

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MicrophoneIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StopIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

export function PlayIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M8.2 5.8c0-.9 1-1.4 1.7-.9l9 6.2c.7.4.7 1.4 0 1.8l-9 6.2c-.7.5-1.7 0-1.7-.9V5.8Z" />
    </svg>
  );
}

export function PauseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="7" y="6" width="3.5" height="12" rx="1" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
