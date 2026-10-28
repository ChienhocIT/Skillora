"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizAttemptForm } from "@/features/learner/quiz-attempt-form";
import { practiceApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { QuizAttempt } from "@/lib/types";

export function QuizPage({ quizId }: { quizId: number }) {
  const [selected, setSelected] = React.useState<QuizAttempt | null>(null);
  const quiz = useQuery({ queryKey: queryKeys.quiz(quizId), queryFn: () => practiceApi.getQuiz(quizId) });
  const attempts = useQuery({
    queryKey: queryKeys.quizAttempts(quizId), queryFn: () => practiceApi.getAttempts(quizId), retry: false,
  });
  const start = useMutation({
    mutationFn: () => practiceApi.startQuiz(quizId),
    onSuccess: async (attempt) => {
      setSelected(attempt);
      await Promise.all([quiz.refetch(), attempts.refetch()]);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const finish = (attempt: QuizAttempt) => {
    setSelected(attempt);
    attempts.refetch();
    if (attempt.status === "EXPIRED") quiz.refetch();
  };
  const attemptList = attempts.data ?? [];
  const current = selected ?? attemptList.find((attempt) => attempt.status === "IN_PROGRESS");
  const inProgress = current?.status === "IN_PROGRESS";
  const maxReached = quiz.data?.maxAttempts != null && attemptList.length >= quiz.data.maxAttempts;
  const questionCount = quiz.data?.questionCount ?? quiz.data?.questions?.length ?? 0;

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto space-y-4">
        {quiz.isLoading ? <PageSkeleton rows={5} /> : null}
        {quiz.isError ? <ErrorState message={(quiz.error as Error).message} onRetry={() => quiz.refetch()} /> : null}
        {quiz.data ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-4">
              <PageHeader title={quiz.data.title} description={quiz.data.description ?? "Complete all questions below."} />
              <p className="text-sm text-muted-foreground">
                {questionCount} questions · Required score: {quiz.data.passScore ?? quiz.data.passingScore ?? 70}%
                {quiz.data.timeLimitMins ? ` · ${quiz.data.timeLimitMins} minutes per attempt` : " · No time limit"}
              </p>
              {current?.status === "EXPIRED" ? <p role="alert">Time is up. This attempt counts toward your limit.</p> : null}
              {!inProgress ? (
                <div className="space-y-2">
                  <Button onClick={() => start.mutate()} disabled={start.isPending || attempts.isLoading || attempts.isError || maxReached || questionCount === 0}>
                    {attemptList.length > 0 ? "Retake Quiz" : "Start Quiz"}
                  </Button>
                  {maxReached ? <p>Maximum quiz attempts reached.</p> : null}
                  {!attemptList.length ? <p className="text-xs text-muted-foreground">The timer starts when you click Start Quiz. Reloading resumes the same attempt.</p> : null}
                </div>
              ) : null}
              {current && current.status !== "EXPIRED" && ((quiz.data.questions?.length ?? 0) > 0 || current.status === "SUBMITTED") ? (
                <QuizAttemptForm key={current.id} quiz={quiz.data} attempt={current} onFinish={finish} />
              ) : null}
            </section>
            <aside>
              <Card className="border border-border/60 rounded-[--radius-card]">
                <CardHeader><CardTitle>Attempt History</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {attempts.isLoading ? <PageSkeleton rows={2} /> : null}
                  {attempts.isError ? <ErrorState message={(attempts.error as Error).message} onRetry={() => attempts.refetch()} /> : null}
                  {attempts.isSuccess && !attemptList.length ? <p>No attempts made yet.</p> : null}
                  {attemptList.map((attempt) => (
                    <div key={attempt.id} className="rounded-lg border border-border/50 p-3 text-xs space-y-2">
                      <div className="flex justify-between gap-2">
                        <span>Attempt {attempt.attemptNo ?? attempt.id}</span>
                        <Badge variant={attempt.passed ? "default" : "secondary"}>
                          {attempt.status === "IN_PROGRESS" ? "In progress" : attempt.status === "EXPIRED" ? "Expired" : attempt.passed ? "Passed" : "Failed"}
                        </Badge>
                      </div>
                      {attempt.status === "SUBMITTED" ? <p>Score: {attempt.score ?? 0}% · {formatDate(attempt.submittedAt)}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
