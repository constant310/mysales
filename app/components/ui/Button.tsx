"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export default function Button({
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Button
  onClick={() => {
    alert("Clicked");
    setWaitlistOpen(true);
  }}
>
  Join Waitlist
</Button>
  );
}