"use client";

import { useActionState } from "react";
import { publishNda } from "@/app/actions/nda";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function NdaEditor({ roomId, title, body, hasSignatures }: { roomId: string; title: string; body: string; hasSignatures: boolean }) {
  const [state, action] = useActionState(publishNda.bind(null, roomId), undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      {hasSignatures && <Alert variant="warning">Publishing a new version invalidates existing signatures: every guest will be asked to sign again on their next visit.</Alert>}
      <Field label="Title">
        <Input name="title" defaultValue={title} required />
      </Field>
      <Field label="Agreement text" hint="Plain text. Blank lines separate paragraphs. Guests must scroll to the end before they can sign.">
        <Textarea name="body" rows={22} defaultValue={body} className="font-mono text-xs leading-relaxed" required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Publishing…">Publish new version</SubmitButton>
      </div>
    </form>
  );
}
