"use client";

import { useRepeatOnHold } from "../hooks/useRepeatOnHold";

interface StepperButtonProps {
  onStep: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

/**
 * + or − button that fires onStep once on click and repeats with acceleration when held.
 */
export function StepperButton({ onStep, children, className, disabled, style, "aria-label": ariaLabel }: StepperButtonProps) {
  const hold = useRepeatOnHold(onStep);
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      style={style}
      aria-label={ariaLabel}
      {...hold}
    >
      {children}
    </button>
  );
}
