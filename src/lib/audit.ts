import { prisma } from "./db";

export type ActorType = "owner" | "guest" | "system";

export interface AuditInput {
  roomId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/** Append an immutable audit record. Never throws: logging must not break the request. */
export async function logEvent(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        roomId: input.roomId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? "",
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        targetName: input.targetName ?? "",
        metadata: JSON.stringify(input.metadata ?? {}),
        ipAddress: input.ip ?? "",
        userAgent: input.userAgent ?? "",
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

/** Human-readable labels for the activity feed. */
export const ACTION_LABELS: Record<string, string> = {
  "owner.signup": "created an account",
  "owner.login": "signed in",
  "owner.logout": "signed out",
  "room.create": "created the data room",
  "room.update": "updated room settings",
  "room.delete": "deleted the data room",
  "folder.create": "created a folder",
  "folder.delete": "deleted a folder",
  "document.upload": "uploaded a document",
  "document.version": "uploaded a new version",
  "document.update": "updated a document",
  "document.delete": "deleted a document",
  "nda.publish": "published a new NDA version",
  "nda.sign": "signed the NDA",
  "invite.create": "invited a guest",
  "invite.resend": "re-sent an invitation",
  "invite.revoke": "revoked access",
  "invite.restore": "restored access",
  "invite.accept": "accepted the invitation",
  "invite.expired": "tried an expired invitation",
  "guest.login": "entered the data room",
  "guest.logout": "left the data room",
  "document.view": "opened a document",
  "document.download": "downloaded a document",
  "question.ask": "asked a question",
  "question.answer": "answered a question",
};
