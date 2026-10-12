"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-surface border border-border rounded-xl p-4 md:p-5", className)}>
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-1.5">
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-navy/40",
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-navy/40",
        props.className
      )}
    />
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-display font-semibold",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-brand-navy text-white hover:bg-brand-navy/90",
        variant === "secondary" && "bg-surface-soft border border-border text-brand-gray hover:bg-border/40",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        className
      )}
    />
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-surface-soft overflow-hidden">
      <div
        className="h-full bg-brand-navy transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    neutral: "bg-surface-soft text-brand-gray",
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    warning: "bg-solar/10 text-solar",
  }[tone];
  return <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", toneClass)}>{children}</span>;
}
