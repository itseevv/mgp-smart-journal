import type { CSSProperties, ReactNode } from "react";

type JournalMobileShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function JournalMobileShell({
  children,
  className = "",
  style,
}: JournalMobileShellProps) {
  return (
    <div
      className={`journal-mobile-shell ${className}`.trim()}
      data-journal-mobile-shell="true"
      style={style}
    >
      <div className="journal-mobile-shell__content">
        {children}
      </div>
    </div>
  );
}
