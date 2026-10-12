import { redirect } from "next/navigation";
import { requireRoom } from "@/lib/auth";

/** Owners preview the guest experience; tracking is disabled for owners. */
export default async function PreviewRedirect({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  await requireRoom(roomId);
  redirect(`/r/${roomId}`);
}
