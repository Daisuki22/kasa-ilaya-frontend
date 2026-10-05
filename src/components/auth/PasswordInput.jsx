import React, { useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const passwordChecks = (value = "") => ({
  length: value.length >= 10,
  uppercase: /[A-Z]/.test(value),
  lowercase: /[a-z]/.test(value),
  number: /[0-9]/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

export const passwordMeetsRequirements = (value) => Object.values(passwordChecks(value)).every(Boolean);

const checkLabels = [
  ["length", "At least 10 characters"],
  ["uppercase", "At least 1 uppercase letter"],
  ["lowercase", "At least 1 lowercase letter"],
  ["number", "At least 1 number"],
  ["special", "At least 1 special character"],
];

export default function PasswordInput({
  id, label, value, onChange, required = false, autoComplete,
  placeholder, showRequirements = false, showRequirementsOnFocus = false,
  showMatch = false, confirmValue,
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const checks = passwordChecks(value);
  const passed = Object.values(checks).filter(Boolean).length;
  const strength = value.length === 0 ? "" : passed <= 2 ? "Weak" : passed <= 3 ? "Fair" : passed < 5 ? "Good" : "Strong";
  const hasConfirmation = typeof confirmValue === "string";
  const passwordsMatch = hasConfirmation && value === confirmValue && value.length > 0;
  const shouldShowRequirements = showRequirements && (
    !showRequirementsOnFocus || focused || Boolean(value)
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        className="relative"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-12"
          aria-describedby={shouldShowRequirements ? `${id}-requirements` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
        {shouldShowRequirements ? (
          <div
            id={`${id}-requirements`}
            className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border bg-card p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150"
            aria-live="polite"
          >
            <p className="mb-2 text-xs font-medium text-foreground">Password must contain:</p>
            <ul className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
              {checkLabels.map(([key, text]) => (
                <li key={key} className={checks[key] ? "flex items-center gap-1.5 text-success dark:text-success" : "flex items-center gap-1.5 text-muted-foreground"}>
                  {checks[key] ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Circle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  {text}
                </li>
              ))}
            </ul>
            {strength ? <p className="mt-2 text-xs text-muted-foreground">Password strength: <span className="font-medium text-foreground">{strength}</span></p> : null}
          </div>
        ) : null}
      </div>
      {showMatch && hasConfirmation && confirmValue.length > 0 ? (
        <p className={passwordsMatch ? "text-xs text-success dark:text-success" : "text-xs text-destructive"} aria-live="polite">
          {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
        </p>
      ) : null}
    </div>
  );
}
