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
  placeholder, showRequirements = false, showMatch = false, confirmValue,
}) {
  const [visible, setVisible] = useState(false);
  const checks = passwordChecks(value);
  const passed = Object.values(checks).filter(Boolean).length;
  const strength = value.length === 0 ? "" : passed <= 2 ? "Weak" : passed <= 3 ? "Fair" : passed < 5 ? "Good" : "Strong";
  const hasConfirmation = typeof confirmValue === "string";
  const passwordsMatch = hasConfirmation && value === confirmValue && value.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-12"
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
      </div>
      {showRequirements ? (
        <div className="space-y-2" aria-live="polite">
          <div className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
            {checkLabels.map(([key, text]) => (
              <p key={key} className={checks[key] ? "flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" : "flex items-center gap-1.5 text-muted-foreground"}>
                {checks[key] ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Circle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {text}
              </p>
            ))}
          </div>
          {strength ? <p className="text-xs text-muted-foreground">Password strength: <span className="font-medium text-foreground">{strength}</span></p> : null}
        </div>
      ) : null}
      {showMatch && hasConfirmation && confirmValue.length > 0 ? (
        <p className={passwordsMatch ? "text-xs text-emerald-700 dark:text-emerald-400" : "text-xs text-destructive"} aria-live="polite">
          {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
        </p>
      ) : null}
    </div>
  );
}
