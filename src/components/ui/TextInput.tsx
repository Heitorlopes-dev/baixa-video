import type { ComponentProps } from "react";
import { CONTROL } from "./control";
import { cx } from "./cx";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(CONTROL, className)} {...props} />;
}
