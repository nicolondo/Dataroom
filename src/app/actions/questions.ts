"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { notifyOwner } from "@/lib/email";
import type { FormState } from "./auth";

export async function answerQuestion(roomId: string, questionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, room } = await requireRoom(roomId);
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return { error: "Write an answer first." };
  const q = await prisma.question.findFirst({ where: { id: questionId, roomId }, include: { guest: true } });
  if (!q) return { error: "Question not found." };
  await prisma.question.update({ where: { id: questionId }, data: { answer, answeredAt: new Date(), answeredById: user.id } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "question.answer", targetType: "question", targetId: questionId, targetName: q.body.slice(0, 80), ...meta });
  await notifyOwner({ to: q.guest.email, subject: `Your question in "${room.name}" was answered`, text: `Question: ${q.body}\n\nAnswer: ${answer}\n\nOpen the data room to see it in context.` });
  revalidatePath(`/rooms/${roomId}/questions`);
  return { success: "Answer posted." };
}

export async function deleteQuestion(roomId: string, questionId: string): Promise<void> {
  await requireRoom(roomId);
  await prisma.question.deleteMany({ where: { id: questionId, roomId } });
  revalidatePath(`/rooms/${roomId}/questions`);
}
