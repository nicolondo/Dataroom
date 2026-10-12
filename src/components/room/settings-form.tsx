"use client";

import { useActionState } from "react";
import { updateRoomSettings } from "@/app/actions/rooms";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

type Room = {
  name: string;
  description: string;
  ndaRequired: boolean;
  allowDownload: boolean;
  watermarkEnabled: boolean;
  inviteExpiryDays: number;
  notifyOnNda: boolean;
  notifyOnFirstView: boolean;
};

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-slate-50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-border" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ roomId, room }: { roomId: string; room: Room }) {
  const [state, action] = useActionState(updateRoomSettings.bind(null, roomId), undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Field label="Room name">
        <Input name="name" defaultValue={room.name} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={3} defaultValue={room.description} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle name="ndaRequired" label="Require NDA signature" hint="Guests must accept the current NDA before any document is shown." defaultChecked={room.ndaRequired} />
        <Toggle name="watermarkEnabled" label="Watermark documents" hint="Overlay the viewer's email and time on every page, in the viewer and on downloads." defaultChecked={room.watermarkEnabled} />
        <Toggle name="allowDownload" label="Allow downloads by default" hint="Can be overridden per document. Downloads are logged and watermarked." defaultChecked={room.allowDownload} />
        <Toggle name="notifyOnNda" label="Email me when an NDA is signed" hint="Requires SMTP to be configured." defaultChecked={room.notifyOnNda} />
        <Toggle name="notifyOnFirstView" label="Email me when a guest first enters" hint="Requires SMTP to be configured." defaultChecked={room.notifyOnFirstView} />
      </div>
      <Field label="Default access duration for new invitations (days)" hint="0 means invitations never expire. You can change the window per guest.">
        <Input name="inviteExpiryDays" type="number" min={0} max={3650} defaultValue={room.inviteExpiryDays} className="w-40" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
