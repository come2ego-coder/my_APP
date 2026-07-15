"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-indigo text-washi shadow-washiLg hover:bg-indigo-dark disabled:bg-indigo/40",
  secondary:
    "bg-white text-indigo border-2 border-indigo/30 hover:border-indigo/60 disabled:opacity-40",
  ghost:
    "bg-transparent text-sumi/70 hover:text-sumi disabled:opacity-40",
};

export default function PillButton({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: PillButtonProps) {
  return (
    <button
      className={`tap-target inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill px-8 py-3 text-[15px] font-bold tracking-wide transition active:scale-[0.98] disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
