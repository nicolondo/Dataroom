import { requireRoom } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui";
import { SettingsForm } from "@/components/room/settings-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteRoom } from "@/app/actions/rooms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room } = await requireRoom(roomId);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Room settings" />
        <div className="p-5">
          <SettingsForm roomId={roomId} room={room} />
        </div>
      </Card>
      <Card className="border-red-200">
        <CardHeader title="Danger zone" description="Deleting the room removes all documents, guests, signatures and analytics." />
        <div className="p-5">
          <form action={deleteRoom.bind(null, roomId)}>
            <ConfirmButton variant="danger" confirm={`Delete "${room.name}" permanently? Type OK to continue.`}>
              Delete this data room
            </ConfirmButton>
          </form>
        </div>
      </Card>
    </div>
  );
}
