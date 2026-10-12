"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { signNda } from "@/app/actions/guest";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function NdaSignForm({
  roomId,
  nda,
  guest,
}: {
  roomId: string;
  nda: { id: string; version: number; title: string; body: string };
  guest: { email: string; name: string; company: string };
}) {
  const [state, action] = useActionState(signNda.bind(null, roomId), undefined);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [name, setName] = useState(guest.name);
  const [agree, setAgree] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setReachedEnd(true);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  const canSign = reachedEnd && name.trim().length >= 2 && agree;

  return (
    <form action={action}>
      <input type="hidden" name="ndaVersionId" value={nda.id} />
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold">{nda.title}</h2>
        <p className="text-xs text-muted">Version {nda.version}</p>
      </div>
      <div ref={scrollRef} className="max-h-[50vh] overflow-y-auto bg-slate-50 px-6 py-5 text-sm leading-relaxed">
        {nda.body.split(/\n\s*\n/).map((para, i) => (
          <p key={i} className="mb-4 whitespace-pre-wrap">
            {para}
          </p>
        ))}
        <p className="mt-6 text-center text-xs text-muted">— End of agreement —</p>
      </div>
      <div className="space-y-4 border-t border-border px-6 py-5">
        {state?.error && <Alert variant="error">{state.error}</Alert>}
        {!reachedEnd && <Alert variant="info">Scroll to the end of the agreement to enable signing.</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full legal name" hint="Typing your name acts as your signature.">
            <Input name="signerName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="Title (optional)">
            <Input name="signerTitle" placeholder="Partner" autoComplete="organization-title" />
          </Field>
          <Field label="Company (optional)">
            <Input name="signerCompany" defaultValue={guest.company} autoComplete="organization" />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
          <span>
            I, <strong>{name.trim() || "…"}</strong> ({guest.email}), have read and agree to be bound by this agreement. I understand my activity in the data room is recorded.
          </span>
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Signed on {new Date().toLocaleDateString()} · your IP address and browser are recorded with the signature.</p>
          <SubmitButton size="lg" disabled={!canSign} pendingText="Signing…">
            Sign and enter
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
