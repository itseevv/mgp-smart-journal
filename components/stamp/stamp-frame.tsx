"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";

export type StampFrameVariant = "lg" | "md" | "sm";

const variantClassNames: Record<StampFrameVariant, string> = {
  lg: "stamp-frame stamp-frame--lg",
  md: "stamp-frame stamp-frame--md",
  sm: "stamp-frame stamp-frame--sm",
};

export function stampFrameClassName(
  variant: StampFrameVariant,
  className = "",
) {
  return [variantClassNames[variant], className].filter(Boolean).join(" ");
}

type StampFrameProps = HTMLAttributes<HTMLDivElement> & {
  variant: StampFrameVariant;
};

export const StampFrame = forwardRef<HTMLDivElement, StampFrameProps>(
  function StampFrame({ variant, className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={stampFrameClassName(variant, className)}
        data-stamp-edge="perforated"
        data-stamp-frame={variant}
        {...props}
      >
        {children}
      </div>
    );
  },
);

type StampFrameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: StampFrameVariant;
};

export const StampFrameButton = forwardRef<
  HTMLButtonElement,
  StampFrameButtonProps
>(function StampFrameButton({ variant, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={stampFrameClassName(variant, className)}
      data-stamp-edge="perforated"
      data-stamp-frame={variant}
      {...props}
    >
      {children}
    </button>
  );
});
