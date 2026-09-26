import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Accessible field wrapper: wires label, description and error message to the
 * control via aria-describedby / aria-invalid.
 */
export function FormField({
  id,
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  /** A single form control; receives id / aria-invalid / aria-describedby. */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-primary">
            *
          </span>
        )}
      </Label>
      {React.cloneElement(children, {
        id,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy,
      })}
      {description && !error && (
        <p id={descriptionId} className="text-muted-foreground text-xs">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
