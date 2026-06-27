import React from "react";

export function Button({
  children,
  className = "",
  variant,
  size,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

  const sizeClass =
    size === "icon"
      ? "h-10 w-10"
      : "h-10 px-4 py-2";

  return (
    <button
      className={`${base} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}