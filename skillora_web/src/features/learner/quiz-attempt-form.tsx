"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { practiceApi } from "@/lib/api";
import type { Quiz, QuizAttempt, QuizAnswerInput } from "@/lib/types";

type Draft = Record<number, Omit<QuizAnswerInput, "questionId">>;

function readDraft(key: string): Draft {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const draft: Draft = {};
      for (const [id, answer] of Object.entries(value)) {
        if (!answer || typeof answer !== "object") continue;
        draft[Number(id)] = {
          selectedOptionIds: Array.isArray(answer.selectedOptionIds) ? answer.selectedOptionIds.filter((n: unknown) => typeof n === "number") : [],
          textAnswer: typeof answer.textAnswer === "string" ? answer.textAnswer : "",
        };
      }
      return draft;
    }
  } catch { /* Storage can be unavailable or contain an obsolete draft. */ }
  return {};
}

function clearDraft(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* In-memory answering still works without storage. */ }
}

export function QuizAttemptForm({ quiz, attempt, onFinish }: {
  quiz: Quiz; attempt: QuizAttempt; onFinish: (attempt: QuizAttempt) => void;
}) {
  const storageKey = `skillora:quiz-attempt:${attempt.id}`;
  const [draft, setDraft] = React.useState<Draft>(() => readDraft(storageKey));
  const questions = quiz.questions ?? [];
  const submitted = attempt.status === "SUBMITTED";
  const submit = useMutation({
    mutationFn: () => practiceApi.submitQuiz(quiz.id, attempt.id, questions.map((q) => q.type === "TEXT"
      ? { questionId: q.id, textAnswer: draft[q.id]?.textAnswer }
      : { questionId: q.id, selectedOptionIds: draft[q.id]?.selectedOptionIds ?? [] })),
    onSuccess: (result) => { clearDraft(storageKey); onFinish(result); toast.success("Quiz submitted"); },
    onError: (error) => toast.error((error as Error).message),
  });
  const change = (id: number, answer: Draft[number]) => {
    const next = { ...draft, [id]: answer };
    setDraft(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep answering in memory. */ }
  };
  const complete = questions.length > 0 && questions.every((q) => q.type === "TEXT"
    ? Boolean(draft[q.id]?.textAnswer?.trim()) : Boolean(draft[q.id]?.selectedOptionIds?.length));

  return (
    <div className="space-y-4">
      {!submitted && attempt.deadlineAt ? (
        <QuizCountdown key={attempt.id} attempt={attempt} onExpire={() => {
          clearDraft(storageKey); onFinish({ ...attempt, status: "EXPIRED" });
        }} />
      ) : null}
      {submitted ? (
        <Card><CardContent className="p-5 space-y-2">
          <h3 className="font-bold">{attempt.passed ? "Quiz Completed!" : "Quiz Failed"}</h3>
          <p>Final Score: {attempt.score} / 100 · Required: {quiz.passScore ?? quiz.passingScore ?? 70}</p>
        </CardContent></Card>
      ) : null}
      {questions.map((question, index) => {
        const result = attempt.answers?.find((answer) => answer.questionId === question.id);
        return (
          <Card key={question.id} className="border border-border/60 rounded-[--radius-card]">
            <CardHeader><CardTitle className="text-sm">Question {index + 1}: {question.content ?? question.text}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {question.type === "TEXT" ? (
                <>
                  <Label htmlFor={`quiz-answer-${question.id}`}>Your answer for question {index + 1}</Label>
                  <Textarea id={`quiz-answer-${question.id}`} maxLength={10000}
                    value={draft[question.id]?.textAnswer ?? ""} disabled={submitted || submit.isPending}
                    onChange={(event) => change(question.id, { textAnswer: event.target.value })} />
                </>
              ) : (question.answerOptions ?? question.options ?? []).map((option) => (
                <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-[--radius-input] border border-border/60 p-3 text-xs">
                  <Checkbox checked={draft[question.id]?.selectedOptionIds?.includes(option.id) ?? false}
                    disabled={submitted || submit.isPending} onCheckedChange={(checked) => {
                      const previous = draft[question.id]?.selectedOptionIds ?? [];
                      const ids = question.type === "MULTIPLE" && checked ? [...previous, option.id] : [option.id];
                      change(question.id, { selectedOptionIds: checked ? ids : previous.filter((id) => id !== option.id) });
                    }} />
                  <span>{option.content ?? option.text}</span>
                </label>
              ))}
              {result ? <p>{result.correct ? "Correct" : "Incorrect"} — {result.pointsEarned ?? 0} pts</p> : null}
            </CardContent>
          </Card>
        );
      })}
      {!submitted ? (
        <div className="space-y-2">
          <Button disabled={!complete || submit.isPending} onClick={() => submit.mutate()}>Submit Quiz</Button>
          {!complete ? <p className="text-xs text-muted-foreground">Please answer all {questions.length} questions before submitting.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function QuizCountdown({ attempt, onExpire }: { attempt: QuizAttempt; onExpire: () => void }) {
  // Compare server timestamps, then monotonic elapsed time; the browser's wall clock is not authoritative.
  const [base] = React.useState(() => ({
    remaining: Math.max(0, Date.parse(attempt.deadlineAt!) - Date.parse(attempt.serverTime)),
    started: performance.now(),
  }));
  const [seconds, setSeconds] = React.useState(() => Math.ceil(base.remaining / 1000));
  React.useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((base.remaining - (performance.now() - base.started)) / 1000));
      setSeconds(left);
      if (left === 0) { clearInterval(timer); onExpire(); }
    }, 250);
    return () => clearInterval(timer);
  }, [base, onExpire]);
  return <p role="timer" aria-label="Time remaining">Time remaining: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>;
}
