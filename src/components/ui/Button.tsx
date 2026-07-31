import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

// Sized/weighted to match scheduling.html's real .btn (md) / .btn-sm
// (sm) scale — the rebuild had been using .btn-sm-equivalent sizing
// (px-3 py-1.5 text-xs) as its default everywhere, which read as
// noticeably smaller/lighter than the live app's real buttons.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark",
  secondary: "bg-teal text-white hover:bg-teal-mid",
  danger: "bg-red-light text-red border border-red/30 hover:bg-red/10",
  ghost: "bg-white text-navy border border-gray-300 hover:bg-gray-100",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-5 py-2.5 text-sm rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}
