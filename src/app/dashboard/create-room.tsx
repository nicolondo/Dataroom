"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createRoom } from "@/app/actions/rooms";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function CreateRoomDialog({ label = "New data room", trigger }: { label?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createRoom, undefined);
  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className="block h-full w-full text-left">
          {trigger}
        </button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {label}
        </Button>
      )}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New data room</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={action} className="space-y-4">
              {state?.error && <Alert variant="error">{state.error}</Alert>}
              <Field label="Name">
                <Input name="name" placeholder="Series A – Project Falcon" autoFocus required />
              </Field>
              <Field label="Description" hint="Shown to guests on the room's landing page.">
                <Textarea name="description" rows={3} placeholder="Financials, cap table and legal documents for prospective investors." />
              </Field>
              <p className="text-xs text-muted">A standard NDA is attached automatically. You can edit it in the room&apos;s NDA tab before inviting anyone.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Creating…">Create room</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
