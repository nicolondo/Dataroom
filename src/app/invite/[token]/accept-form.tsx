"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/guest";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function AcceptForm({ token, knownName, knownCompany }: { token: string; knownName: string; knownCompany: string }) {
  const [state, action] = useActionState(acceptInvite.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <Field label="Your full name">
        <Input name="name" defaultValue={knownName} autoComplete="name" required={!knownName} />
      </Field>
      <Field label="Company (optional)">
        <Input name="company" defaultValue={knownCompany} autoComplete="organization" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Opening…">
        Enter the data room
      </SubmitButton>
    </form>
  );
}
