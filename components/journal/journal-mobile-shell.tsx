import type { ReactNode } from "react";

type JournalMobileShellProps = {
  children: ReactNode;
  className?: string;
};

export function JournalMobileShell({
  children,
  className = "",
}: JournalMobileShellProps) {
  return (
    <div
      className={`journal-mobile-shell ${className}`.trim()}
      data-journal-mobile-shell="true"
    >
      {children}
    </div>
  );
}
