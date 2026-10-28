"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle2, Send, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { practiceApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function AssignmentPage({ assignmentId }: { assignmentId: number }) {
  const [content, setContent] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");

  const assignment = useQuery({
    queryKey: queryKeys.assignment(assignmentId),
    queryFn: () => practiceApi.getAssignment(assignmentId),
  });

  const submit = useMutation({
    mutationFn: () => practiceApi.submitAssignment(assignmentId, { content, fileUrl }),
    onSuccess: () => {
      toast.success("Assignment submitted successfully");
      assignment.refetch();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const assignmentData = assignment.data;
  const mySubmission = assignmentData?.mySubmission;

  const prevSubmissionId = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (!mySubmission || mySubmission.id === prevSubmissionId.current) {
      return;
    }
    prevSubmissionId.current = mySubmission.id;
    setContent((current) => current || mySubmission.content || "");
    setFileUrl((current) => current || mySubmission.fileUrl || "");
  }, [mySubmission]);

  const isSubmitted = Boolean(mySubmission && mySubmission.status !== "RETURNED");
  const isGraded = mySubmission?.status === "GRADED";
  const dueAt = assignmentData?.dueAt;

  // Overdue check
  const isOverdue = (() => {
    if (!dueAt) return false;
    const due = new Date(dueAt);
    const now = new Date();
    return now > due && !isSubmitted;
  })();

  return (
    <AppShell>
      <div className="max-w-[1280px] mx-auto space-y-4">
        {assignment.isLoading ? <PageSkeleton rows={4} /> : null}
        {assignment.isError ? (
          <ErrorState
            message={(assignment.error as Error).message}
            onRetry={() => assignment.refetch()}
          />
        ) : null}

        {assignmentData ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-5">
              <PageHeader
                title={assignmentData.title}
                description={assignmentData.lessonTitle ?? "Read instructions and submit your work."}
                actions={<StatusBadge status={mySubmission?.status ?? "UNSUBMITTED"} />}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[--radius-card] border border-border/60 bg-card/75 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                  <p className="text-xs font-semibold text-muted-foreground">Due date</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{formatDate(assignmentData.dueAt)}</p>
                </div>
                <div className="rounded-[--radius-card] border border-border/60 bg-card/75 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                  <p className="text-xs font-semibold text-muted-foreground">Max score</p>
                  <p className="mt-1 text-sm font-extrabold text-foreground">{assignmentData.maxScore ?? 100} pts</p>
                </div>
                <div className="rounded-[--radius-card] border border-border/60 bg-card/75 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                  <p className="text-xs font-semibold text-muted-foreground">Your score</p>
                  <p className={cn("mt-1 text-sm font-extrabold", isGraded ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                    {isGraded ? `${mySubmission.score} pts` : "Awaiting grade"}
                  </p>
                </div>
              </div>

              {/* Overdue alert banner */}
              {isOverdue ? (
                <Card className="border-destructive/30 bg-destructive/5 text-destructive p-4 flex gap-3 items-start rounded-[--radius-card]">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Past Due Date</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">
                      This assignment is overdue. You can still submit, but it might be flagged.
                    </p>
                  </div>
                </Card>
              ) : null}

              {/* Instructions */}
              <Card className="border border-border/60 rounded-[--radius-card] shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground/90">
                  {assignmentData.instructions ?? assignmentData.description ?? "No instructions provided."}
                </CardContent>
              </Card>

              {/* Submit work */}
              <Card className="border border-border/60 rounded-[--radius-card] shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-foreground">Your Submission</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="submission-content" className="text-sm font-bold text-foreground">Submission notes / description</Label>
                    <Textarea
                      id="submission-content"
                      rows={6}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Write details or summary of your work..."
                      disabled={isSubmitted || submit.isPending}
                      className="min-h-40 rounded-[--radius-input] border-border/70 text-sm transition-all placeholder:text-muted-foreground/60"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="submission-file" className="text-sm font-bold text-foreground">File URL (e.g. Google Drive, GitHub repo)</Label>
                    <Input
                      id="submission-file"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="https://example.com/your-file"
                      disabled={isSubmitted || submit.isPending}
                      className="h-11 rounded-[--radius-input] border-border/70 text-sm"
                    />
                  </div>

                  {!isSubmitted ? (
                    <Button
                      disabled={submit.isPending || (!content.trim() && !fileUrl.trim())}
                      onClick={() => submit.mutate()}
                      className="mt-2 h-11 rounded-[--radius-button] px-5 text-sm font-bold"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Submit Assignment
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-border/50 p-4 bg-muted/10 text-xs text-muted-foreground leading-relaxed mt-2">
                      <div className="flex gap-2.5 items-start">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-foreground">Submission Recorded</p>
                          <p className="text-muted-foreground/80 mt-0.5">Your work was recorded on {formatDate(mySubmission?.submittedAt)}.</p>
                        </div>
                      </div>
                      {mySubmission?.fileUrl ? (
                        <div className="mt-3">
                          <Button asChild variant="outline" size="sm" className="h-8 text-[11px] font-bold rounded-[--radius-button] border-border/70 text-muted-foreground hover:text-foreground">
                            <a
                              href={mySubmission.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-primary" />
                              Open Submitted Link
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
              {/* Status card */}
              <Card className="border border-border/60 rounded-[--radius-card] shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold text-foreground">Submission Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs font-semibold text-muted-foreground/90">
                  <div className="flex justify-between items-center">
                    <span>Status</span>
                    <StatusBadge status={mySubmission?.status ?? "UNSUBMITTED"} />
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/85" />
                      Due date
                    </span>
                    <span className="font-semibold text-foreground">{formatDate(assignmentData.dueAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Max score</span>
                    <span className="font-extrabold text-foreground">{assignmentData.maxScore ?? 100} pts</span>
                  </div>
                  {mySubmission?.late || assignmentData.overdue ? (
                    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-destructive font-bold text-[11px] leading-normal flex gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>This submission is marked late.</span>
                    </div>
                  ) : null}

                  {isGraded ? (
                    <>
                      <Separator className="bg-border/50" />
                      <div className="space-y-3 pt-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span>Your Score</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{mySubmission.score} / {assignmentData.maxScore ?? 100}</span>
                        </div>
                        <p className="text-xs font-bold">
                          {mySubmission.passed == null ? "Awaiting instructor pass/fail confirmation" : mySubmission.passed ? "Passed" : "Not passed"}
                        </p>
                        {mySubmission.feedback ? (
                          <div className="rounded-lg bg-muted/20 p-3 text-xs text-muted-foreground/90 border border-border/55">
                            <p className="font-bold text-foreground mb-1.5">Instructor feedback:</p>
                            <p className="whitespace-pre-wrap leading-relaxed font-semibold">{mySubmission.feedback}</p>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
