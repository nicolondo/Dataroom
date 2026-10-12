"use client";

import { useActionState } from "react";
import { updateDocument } from "@/app/actions/documents";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function DocumentEditForm({
  roomId,
  doc,
  folders,
}: {
  roomId: string;
  doc: { id: string; title: string; description: string; folderId: string | null; published: boolean; allowDownload: boolean | null };
  folders: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(updateDocument.bind(null, roomId, doc.id), undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}
      <Field label="Title">
        <Input name="title" defaultValue={doc.title} required />
      </Field>
      <Field label="Description" hint="Shown to guests under the title.">
        <Textarea name="description" rows={2} defaultValue={doc.description} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Folder">
          <Select name="folderId" defaultValue={doc.folderId ?? ""}>
            <option value="">Root</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Downloads">
          <Select name="allowDownload" defaultValue={doc.allowDownload === null ? "inherit" : doc.allowDownload ? "yes" : "no"}>
            <option value="inherit">Use room setting</option>
            <option value="yes">Allowed (watermarked)</option>
            <option value="no">View only</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={doc.published} className="h-4 w-4 rounded border-border" />
        Visible to guests
      </label>
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
