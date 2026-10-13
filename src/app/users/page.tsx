import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate, initials, timeAgo } from "@/lib/format";
import { CreateUserForm, ResetPasswordForm } from "./forms";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteUser } from "@/app/actions/users";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Team" };

export default async function UsersPage() {
  const me = await requireUser();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { rooms: true, invitesSent: true } } } });
  return (
    <>
      <PageHeader title="Team" description="Everyone here can sign in, manage every data room, invite guests and administer other team members." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Members" />
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Member</Th>
                  <Th>Last sign-in</Th>
                  <Th>Added</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar text={initials(u.name || u.email)} />
                        <span>
                          <span className="block font-medium">
                            {u.name} {u.id === me.id && <Badge className="ml-1">You</Badge>}
                          </span>
                          <span className="block text-xs text-muted">
                            {u.email} · {u._count.rooms} rooms · {u._count.invitesSent} invites sent
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td className="text-muted">{timeAgo(u.lastLoginAt)}</Td>
                    <Td className="text-muted">{formatDate(u.createdAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <ResetPasswordForm userId={u.id} email={u.email} />
                        {u.id !== me.id && users.length > 1 && (
                          <form action={deleteUser.bind(null, u.id)}>
                            <ConfirmButton variant="ghost" size="sm" className="text-red-600" confirm={`Remove ${u.email}? Their rooms and invitations are transferred to you.`} title="Remove member">
                              <Trash2 className="h-3.5 w-3.5" />
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
        <Card>
          <CardHeader title="Add a team member" description="They sign in with the password you set here and can change it from their account page." />
          <div className="p-5">
            <CreateUserForm />
          </div>
        </Card>
      </div>
    </>
  );
}
