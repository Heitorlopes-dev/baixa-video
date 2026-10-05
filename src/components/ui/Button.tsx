import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Cada variante com o seu estilo e o tamanho que ela usa quando ninguém pede outro. */
const VARIANTS = {
  primary: {
    classes: "rounded-md bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:opacity-50",
    size: "lg",
  },
  danger: { classes: "rounded-md bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50", size: "lg" },
  secondary: {
    classes: "rounded-md border border-neutral-400/50 hover:bg-neutral-500/10 disabled:opacity-50",
    size: "md",
  },
  link: { classes: "text-sm underline opacity-70 hover:opacity-100 disabled:opacity-40", size: "none" },
} as const;

const SIZES = {
  none: "",
  sm: "px-3 py-1.5",
  md: "px-3 py-2",
  lg: "px-5 py-2",
} as const;

type Props = ComponentProps<"button"> & {
  variant: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({ variant, size, className, type = "button", ...props }: Props) {
  const { classes, size: defaultSize } = VARIANTS[variant];
  return <button type={type} className={cx(classes, SIZES[size ?? defaultSize], className)} {...props} />;
}
