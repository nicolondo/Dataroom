import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getRoomViewer } from "@/lib/room-viewer";
import { Card } from "@/components/ui";
import { NdaSignForm } from "./sign-form";

export const metadata = { title: "Sign NDA" };

export default async function NdaSignPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const viewer = await getRoomViewer(roomId);
  if (viewer.kind === "none") return null;
  if (viewer.kind === "owner") redirect(`/r/${roomId}`);
  const { access } = viewer;
  if (access.ndaSatisfied || !access.nda) redirect(`/r/${roomId}`);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-accent">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Before you continue</h1>
          <p className="text-sm text-muted">
            {access.room.ownerName} requires everyone to accept the agreement below before any document in <strong>{access.room.name}</strong> is shown. Read it to the end, then sign with your name.
          </p>
        </div>
      </div>
      <Card className="overflow-hidden">
        <NdaSignForm roomId={roomId} nda={access.nda} guest={access.guest} />
      </Card>
    </div>
  );
}
