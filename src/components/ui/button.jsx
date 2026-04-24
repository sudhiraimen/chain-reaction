import React from "react";

export function Button({ className = "", variant, size, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold transition disabled:opacity-50 ${
        variant === "secondary"
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-white text-slate-950 hover:bg-white/90"
      } ${className}`}
      {...props}
    />
  );
}