"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword, sendTestEmail, updateProfile } from "@/app/actions/users";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function ProfileForm({ user }: { user: { name: string; email: string } }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Field label="Name">
        <Input name="name" defaultValue={user.name} required />
      </Field>
      <Field label="Email" hint="You sign in with this address.">
        <Input name="email" type="email" defaultValue={user.email} required />
      </Field>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Field label="Current password">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Repeat new password">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton pendingText="Changing…">Change password</SubmitButton>
    </form>
  );
}

export function TestEmailForm({ configured, from }: { configured: boolean; from: string }) {
  const [state, action] = useActionState(sendTestEmail, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <p className="text-sm text-muted">
        {configured ? (
          <>
            Outgoing mail is configured. Messages are sent from <span className="font-medium text-foreground">{from}</span>.
          </>
        ) : (
          "Outgoing mail is not configured: invitation links must be shared manually. Set SMTP_URL in the server's .env file."
        )}
      </p>
      <SubmitButton variant="secondary" disabled={!configured} pendingText="Sending…">
        Send me a test email
      </SubmitButton>
    </form>
  );
}
