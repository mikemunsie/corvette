import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "display inline-flex items-center justify-center rounded-sm px-4 py-2 text-xs uppercase tracking-widest transition disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "border border-cyan bg-cyan/10 text-cyan shadow-[0_0_16px_rgba(61,255,245,0.25)] hover:bg-cyan/20",
        magenta:
          "border border-magenta bg-magenta/10 text-magenta shadow-[0_0_16px_rgba(255,45,149,0.25)] hover:bg-magenta/20",
        ghost: "border border-white/15 text-white/80 hover:border-cyan/50",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
