"use client";

import { Button } from "@/components/ui";
import type { ComponentProps } from "react";

/** Submit button that asks for confirmation before the form posts. */
export function ConfirmButton({ confirm, onClick, ...props }: ComponentProps<typeof Button> & { confirm: string }) {
  return (
    <Button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}
