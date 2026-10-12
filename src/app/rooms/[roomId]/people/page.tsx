import Link from "next/link";
import { Mail, Ban, RotateCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import { requireRoom } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { guestEngagement } from "@/lib/analytics";
import { emailConfigured, inviteUrl } from "@/lib/email";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { formatDuration, initials, timeAgo, formatDate } from "@/lib/format";
import { InviteForm } from "@/components/room/invite-form";
import { CopyButton } from "@/components/forms/copy-button";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { resendInvite, restoreInvite, revokeInvite } from "@/app/actions/invites";

export const metadata = { title: "People" };

export default async function PeoplePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room } = await requireRoom(roomId);
  const [guests, invites] = await Promise.all([guestEngagement(roomId), prisma.invite.findMany({ where: { roomId }, select: { id: true, token: true } })]);
  const tokenByInvite = new Map(invites.map((i) => [i.id, i.token]));
  const now = new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Invite reviewers" description={room.ndaRequired ? "Guests must sign the NDA before they can open any document." : "This room has no NDA gate. Turn it on in Settings."} />
        <div className="p-5">
          <InviteForm roomId={roomId} defaultExpiryDays={room.inviteExpiryDays} emailConfigured={emailConfigured()} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Guest list" description="Everyone who has been invited, their NDA status and how much time they have spent reviewing." />
        {guests.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No guests yet" description="Invite someone above to get started." />
          </div>
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Guest</Th>
                <Th>Access</Th>
                <Th>NDA</Th>
                <Th>Time reviewing</Th>
                <Th>Docs</Th>
                <Th>Last seen</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guests.map((g) => {
                const expired = g.expiresAt ? g.expiresAt < now : false;
                const token = tokenByInvite.get(g.inviteId) ?? "";
                return (
                  <tr key={g.inviteId} className={g.status === "revoked" ? "opacity-60" : ""}>
                    <Td>
                      <Link href={`/rooms/${roomId}/people/${g.inviteId}`} className="flex items-center gap-2 hover:text-accent">
                        <Avatar text={initials(g.name || g.email)} />
                        <span>
                          <span className="block font-medium">{g.name || g.email}</span>
                          <span className="block text-xs text-muted">{g.name ? g.email : ""}{g.company ? ` · ${g.company}` : ""}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      {g.status === "revoked" ? (
                        <Badge variant="danger">Revoked</Badge>
                      ) : expired ? (
                        <Badge variant="warning">Expired {formatDate(g.expiresAt)}</Badge>
                      ) : g.status === "active" ? (
                        <Badge variant="success">Active{g.expiresAt ? ` until ${g.expiresAt.toLocaleDateString()}` : ""}</Badge>
                      ) : (
                        <Badge>Invited</Badge>
                      )}
                    </Td>
                    <Td>
                      {!room.ndaRequired ? (
                        <span className="text-xs text-muted">Not required</span>
                      ) : g.ndaCurrent ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title={formatDate(g.ndaSignedAt)}>
                          <ShieldCheck className="h-4 w-4" /> Signed {timeAgo(g.ndaSignedAt)}
                        </span>
                      ) : g.ndaSignedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <ShieldAlert className="h-4 w-4" /> Old version
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Not signed</span>
                      )}
                    </Td>
                    <Td className="tabular-nums font-medium">{formatDuration(g.totalSeconds)}</Td>
                    <Td className="tabular-nums">{g.documentsViewed}</Td>
                    <Td className="text-muted">{timeAgo(g.lastSeenAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {g.status !== "revoked" && (
                          <>
                            <CopyButton value={inviteUrl(token)} label="Link" />
                            <form action={resendInvite.bind(null, roomId, g.inviteId)}>
                              <Button type="submit" variant="ghost" size="sm" title="Resend invitation email">
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                            <form action={revokeInvite.bind(null, roomId, g.inviteId)}>
                              <ConfirmButton variant="ghost" size="sm" className="text-red-600" confirm={`Revoke access for ${g.email}? Their sessions end immediately.`} title="Revoke access">
                                <Ban className="h-3.5 w-3.5" />
                              </ConfirmButton>
                            </form>
                          </>
                        )}
                        {g.status === "revoked" && (
                          <form action={restoreInvite.bind(null, roomId, g.inviteId)}>
                            <Button type="submit" variant="secondary" size="sm">
                              <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </Button>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
