import { Lock, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { Alert, Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token }, include: { guest: true, room: { include: { owner: { select: { name: true } }, _count: { select: { documents: { where: { published: true } } } } } } } });

  let problem: string | null = null;
  if (!invite) problem = "This invitation link is not valid. Check that you copied the whole link.";
  else if (invite.status === "revoked") problem = "Access to this data room has been revoked. Contact the person who invited you.";
  else if (invite.expiresAt && invite.expiresAt < new Date()) problem = `This invitation expired on ${formatDate(invite.expiresAt)}. Ask the sender for a new link.`;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
            <Lock className="h-4 w-4" />
          </span>
          Data Room
        </div>
        <Card className="p-6">
          {problem || !invite ? (
            <Alert variant="error">{problem}</Alert>
          ) : (
            <>
              <p className="text-sm text-muted">{invite.room.owner.name} has invited you to review</p>
              <h1 className="mt-1 text-xl font-semibold">{invite.room.name}</h1>
              {invite.room.description && <p className="mt-1 text-sm text-muted">{invite.room.description}</p>}
              {invite.message && <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic text-slate-700">“{invite.message}”</blockquote>}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <dt className="font-medium text-slate-700">Invited as</dt>
                  <dd>{invite.guest.email}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Documents</dt>
                  <dd>{invite.room._count.documents}</dd>
                </div>
                {invite.expiresAt && (
                  <div className="col-span-2">
                    <dt className="font-medium text-slate-700">Access until</dt>
                    <dd>{formatDate(invite.expiresAt)}</dd>
                  </div>
                )}
              </dl>
              {invite.room.ndaRequired && (
                <div className="mt-4 flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>You will be asked to sign a non-disclosure agreement before any document is shown. Your activity in the room is logged.</span>
                </div>
              )}
              <div className="mt-5">
                <AcceptForm token={token} knownName={invite.guest.name} knownCompany={invite.guest.company} />
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
