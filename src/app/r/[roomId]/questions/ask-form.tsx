"use client";

import { useActionState, useEffect, useRef } from "react";
import { askQuestion } from "@/app/actions/guest";
import { Alert, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function AskForm({ roomId, documentId }: { roomId: string; documentId: string | null }) {
  const [state, action] = useActionState(askQuestion.bind(null, roomId, documentId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Textarea name="body" rows={4} placeholder="e.g. Can you share the assumptions behind the 2027 revenue forecast on page 12?" required />
      <div className="flex justify-end">
        <SubmitButton pendingText="Sending…">Send question</SubmitButton>
      </div>
    </form>
  );
}
