"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { createUser, resetUserPassword } from "@/app/actions/users";
import { Alert, Button, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function CreateUserForm() {
  const [state, action] = useActionState(createUser, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Field label="Name">
        <Input name="name" autoComplete="off" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="off" required />
      </Field>
      <Field label="Initial password" hint="At least 8 characters. Share it with them privately.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Adding…">
        Add member
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resetUserPassword.bind(null, userId), undefined);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} title="Set a new password">
        <KeyRound className="h-3.5 w-3.5" /> Password
      </Button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">New password for {email}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={action} className="space-y-4">
              {state?.error && <Alert variant="error">{state.error}</Alert>}
              {state?.success && <Alert variant="success">{state.success}</Alert>}
              <Field label="New password" hint="At least 8 characters. Their other sessions are signed out.">
                <Input name="password" type="password" autoComplete="new-password" minLength={8} autoFocus required />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Saving…">Set password</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
