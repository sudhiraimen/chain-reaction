import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={`rounded-3xl ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}