"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvite } from "@/app/actions/invites";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";
import { CopyButton } from "@/components/forms/copy-button";

export function InviteForm({ roomId, defaultExpiryDays, emailConfigured }: { roomId: string; defaultExpiryDays: number; emailConfigured: boolean }) {
  const [state, action] = useActionState(createInvite.bind(null, roomId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && (
        <Alert variant="success">
          <p>{state.success}</p>
          {state.link && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-white/70 px-2 py-1 text-xs break-all">{state.link}</code>
              <CopyButton value={state.link} />
            </div>
          )}
          {!state.emailed && <p className="mt-1 text-xs">Email delivery is not configured, so share the link yourself (it is also available from the guest list).</p>}
        </Alert>
      )}
      <Field label="Email addresses" hint="Separate several addresses with commas or new lines. Each person gets their own private link.">
        <Textarea name="emails" rows={2} placeholder="alex@investor.com, sam@fund.vc" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name (single invite)">
          <Input name="name" placeholder="Alex Rivera" />
        </Field>
        <Field label="Company">
          <Input name="company" placeholder="Falcon Capital" />
        </Field>
        <Field label="Access expires in (days)" hint="0 = never">
          <Input name="expiryDays" type="number" min={0} max={3650} defaultValue={defaultExpiryDays} />
        </Field>
      </div>
      <Field label="Personal message (optional)">
        <Textarea name="message" rows={2} placeholder="Looking forward to your review. Reach out with any questions." />
      </Field>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{emailConfigured ? "An invitation email is sent immediately." : "SMTP is not configured: you will get a link to share manually."}</p>
        <SubmitButton pendingText="Inviting…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}
