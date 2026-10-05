import type { ComponentProps } from "react";
import { CONTROL, CONTROL_COLORS } from "./control";
import { cx } from "./cx";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = Omit<ComponentProps<"select">, "value" | "onChange" | "children"> & {
  options: readonly Option<T>[];
  value: T;
  onValueChange: (value: T) => void;
};

export function Select<T extends string>({ options, value, onValueChange, className, ...props }: Props<T>) {
  return (
    <select
      className={cx(CONTROL, className)}
      value={value}
      onChange={(e) => {
        const picked = options.find((o) => o.value === e.currentTarget.value);
        if (picked) onValueChange(picked.value);
      }}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className={CONTROL_COLORS}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
