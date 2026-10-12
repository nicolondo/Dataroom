"use client";

import { useActionState, useEffect, useRef } from "react";
import { FolderPlus } from "lucide-react";
import { createFolder } from "@/app/actions/documents";
import { Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function FolderForm({ roomId }: { roomId: string }) {
  const [state, action] = useActionState(createFolder.bind(null, roomId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex items-center gap-2">
      <Input name="name" placeholder="New folder name" className="h-8 w-48 text-xs" required />
      <SubmitButton variant="secondary" size="sm" pendingText="Adding…">
        <FolderPlus className="h-3.5 w-3.5" /> Add folder
      </SubmitButton>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
