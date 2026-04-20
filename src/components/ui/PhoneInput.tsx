import React from "react";
import { Input } from "@/components/ui/input";
import { formatPhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      e.target.value = formatted;
      onChange(e);
    };

    return (
      <Input
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
        className={cn("bg-white/5 border-white/10", className)}
        placeholder="(555) 000-0000"
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
