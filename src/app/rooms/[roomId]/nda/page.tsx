import { FileDown } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { Badge, Card, CardHeader, Table, Td, Th, Alert } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { NdaEditor } from "@/components/room/nda-editor";

export const metadata = { title: "NDA" };

export default async function NdaPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room } = await requireRoom(roomId);
  const [versions, signatures] = await Promise.all([
    prisma.ndaVersion.findMany({ where: { roomId }, orderBy: { version: "desc" }, include: { _count: { select: { signatures: true } } } }),
    prisma.ndaSignature.findMany({ where: { roomId }, orderBy: { signedAt: "desc" }, include: { guest: true, ndaVersion: { select: { version: true } }, invite: { select: { id: true } } } }),
  ]);
  const current = versions[0];

  return (
    <div className="space-y-6">
      {!room.ndaRequired && (
        <Alert variant="warning">
          The NDA gate is currently <strong>off</strong> for this room. Guests can view documents without signing. Enable it in{" "}
          <Link href={`/rooms/${roomId}/settings`} className="underline">
            Settings
          </Link>
          .
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={current ? `Current agreement · version ${current.version}` : "Agreement"}
              description={current ? `Published ${formatDate(current.createdAt)} · ${current._count.signatures} signature${current._count.signatures === 1 ? "" : "s"}` : "No agreement yet."}
            />
            <div className="p-5">
              <NdaEditor roomId={roomId} title={current?.title ?? "Non-Disclosure Agreement"} body={current?.body ?? ""} hasSignatures={signatures.length > 0} />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Version history" />
            <ul className="divide-y divide-border text-sm">
              {versions.map((v, i) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3">
                  <span>
                    <span className="font-medium">v{v.version}</span> {i === 0 && <Badge variant="success">Current</Badge>}
                    <span className="block text-xs text-muted">{formatDate(v.createdAt)}</span>
                  </span>
                  <span className="text-xs text-muted">{v._count.signatures} signed</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Signatures" description="Every acceptance is recorded with the signer's identity, time, IP address and a hash of the exact text they agreed to." />
        {signatures.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No signatures yet.</p>
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Signer</Th>
                <Th>Email</Th>
                <Th>Version</Th>
                <Th>Signed at</Th>
                <Th>IP</Th>
                <Th>Record</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signatures.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/rooms/${roomId}/people/${s.invite.id}`} className="font-medium hover:text-accent">
                      {s.signerName}
                    </Link>
                    {s.signerCompany && <span className="block text-xs text-muted">{s.signerTitle ? `${s.signerTitle}, ` : ""}{s.signerCompany}</span>}
                  </Td>
                  <Td className="text-muted">{s.signerEmail}</Td>
                  <Td>
                    {current && s.ndaVersion.version === current.version ? <Badge variant="success">v{s.ndaVersion.version}</Badge> : <Badge variant="warning">v{s.ndaVersion.version} (old)</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatDate(s.signedAt)}</Td>
                  <Td className="font-mono text-xs text-muted">{s.ipAddress || "—"}</Td>
                  <Td>
                    <a href={`/api/nda/${s.id}/certificate`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
