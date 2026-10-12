"use client";

import { useActionState } from "react";
import { answerQuestion } from "@/app/actions/questions";
import { Alert, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function AnswerForm({ roomId, questionId, existing }: { roomId: string; questionId: string; existing?: string | null }) {
  const [state, action] = useActionState(answerQuestion.bind(null, roomId, questionId), undefined);
  return (
    <form action={action} className="mt-3 space-y-2">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <Textarea name="answer" rows={3} defaultValue={existing ?? ""} placeholder="Write your answer. The guest is emailed when SMTP is configured." required />
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Posting…">
          {existing ? "Update answer" : "Post answer"}
        </SubmitButton>
      </div>
    </form>
  );
}
