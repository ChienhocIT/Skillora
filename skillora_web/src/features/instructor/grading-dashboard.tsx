"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { courseApi, instructorApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { AssignmentSubmission } from "@/lib/types";

export function GradingPage() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("");
  const [selectedAssignmentId, setSelectedAssignmentId] = React.useState<string>("");
  const [status, setStatus] = React.useState("ALL");
  const [page, setPage] = React.useState(0);

  const handleCourseChange = (val: string) => {
    setSelectedCourseId(val);
    setSelectedAssignmentId("");
    setPage(0);
  };

  // 1. Fetch instructor's courses
  const myCourses = useQuery({
    queryKey: queryKeys.instructorCourses(),
    queryFn: () => instructorApi.myCourses({ page: 0, size: 100 }),
  });

  // 2. Fetch sections & lessons to find assignment IDs for the selected course
  const courseIdNum = selectedCourseId ? Number(selectedCourseId) : undefined;
  const sections = useQuery({
    queryKey: queryKeys.builderSections(courseIdNum!),
    queryFn: () => courseApi.getSections(courseIdNum!),
    enabled: Boolean(courseIdNum),
  });

  // Extract all assignments from lessons
  const assignmentsList = React.useMemo(() => {
    if (!sections.data) return [];
    const found: Array<{ id: number; title: string }> = [];
    sections.data.forEach((section) => {
      section.lessons?.forEach((lesson) => {
        if (lesson.assignmentId) {
          found.push({
            id: lesson.assignmentId,
            title: lesson.title ? `Assignment: ${lesson.title}` : `Assignment #${lesson.assignmentId}`,
          });
        }
      });
    });
    return found;
  }, [sections.data]);

  // 3. Fetch submissions for the selected assignment
  const assignmentIdNum = selectedAssignmentId ? Number(selectedAssignmentId) : undefined;
  const submissions = useQuery({
    queryKey: ["assignment-submissions", assignmentIdNum, status, page],
    queryFn: () =>
      instructorApi.getSubmissions(assignmentIdNum!, {
        status: status === "ALL" ? undefined : status,
        page,
        size: 20,
      }),
    enabled: Boolean(assignmentIdNum),
  });

  const grade = useMutation({
    mutationFn: ({ id, score, passed, feedback }: { id: number; score: number; passed: boolean; feedback: string }) =>
      instructorApi.gradeSubmission(id, { status: "GRADED", score, passed, feedback }),
    onSuccess: () => {
      toast.success("Submission graded");
      queryClient.invalidateQueries({
        queryKey: ["assignment-submissions", assignmentIdNum],
      });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const returnForRevision = useMutation({
    mutationFn: ({ id, feedback }: { id: number; feedback: string }) =>
      instructorApi.gradeSubmission(id, { status: "RETURNED", feedback }),
    onSuccess: () => {
      toast.success("Submission returned for revision");
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentIdNum] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const courseList = myCourses.data?.content ?? [];
  const submissionList = submissions.data?.content ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Grading Queue"
        description="Select a course and lesson assignment below to review and grade student homework."
      />

      {/* Select selectors */}
      <Card className="mb-6 bg-card/90">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3 items-end">
          <div className="grid gap-2">
            <Label>Course</Label>
            {myCourses.isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select value={selectedCourseId} onValueChange={handleCourseChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course..." />
                </SelectTrigger>
                <SelectContent>
                  {courseList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Assignment Task</Label>
            {sections.isFetching ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select
                value={selectedAssignmentId}
                onValueChange={(value) => {
                  setSelectedAssignmentId(value);
                  setPage(0);
                }}
                disabled={!selectedCourseId || assignmentsList.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedCourseId
                        ? "Choose a course first"
                        : assignmentsList.length === 0
                          ? "No assignments in this course"
                          : "Select assignment..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignmentsList.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(0); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="GRADED">Graded</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedCourseId ? (
        <EmptyState
          title="Choose a course to start grading"
          message="Pick one of your courses above. Skillora will then show the assignments that currently accept learner submissions."
        />
      ) : null}

      {selectedCourseId && !selectedAssignmentId && assignmentsList.length === 0 && !sections.isFetching ? (
        <EmptyState
          title="No assignments in this course"
          message="Add an assignment to a lesson in the course builder before grading submissions here."
        />
      ) : null}

      {selectedCourseId && assignmentsList.length > 0 && !selectedAssignmentId ? (
        <EmptyState
          title="Select an assignment"
          message="Choose an assignment task above to review submitted work, leave feedback, and return scores."
        />
      ) : null}

      {/* Loading state for submissions */}
      {submissions.isFetching ? <PageSkeleton rows={4} /> : null}

      {/* Error state */}
      {submissions.isError ? (
        <ErrorState
          message={(submissions.error as Error).message}
          onRetry={() => submissions.refetch()}
        />
      ) : null}

      {/* Empty State */}
      {selectedAssignmentId && submissionList.length === 0 && submissions.isSuccess ? (
        <EmptyState
          title="No submissions yet"
          message="Students have not uploaded any solutions for this assignment task."
        />
      ) : null}

      {/* Submissions Table */}
      {selectedAssignmentId && submissionList.length > 0 ? (
        <div className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Submission Content</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[300px]">Grade & Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionList.map((sub) => (
                  <SubmissionGradeRow
                    key={sub.id}
                    submission={sub}
                    onGrade={(score, feedback, passed) =>
                      grade.mutate({ id: sub.id, score, feedback, passed })
                    }
                    onReturn={(feedback) => returnForRevision.mutate({ id: sub.id, feedback })}
                    isSubmitting={grade.isPending || returnForRevision.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
          {submissions.data && submissions.data.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {submissions.data.page + 1} of {submissions.data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={submissions.data.first} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={submissions.data.last} onClick={() => setPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function SubmissionGradeRow({
  submission,
  onGrade,
  onReturn,
  isSubmitting,
}: {
  submission: AssignmentSubmission;
  onGrade: (score: number, feedback: string, passed: boolean) => void;
  onReturn: (feedback: string) => void;
  isSubmitting: boolean;
}) {
  const [score, setScore] = React.useState(String(submission.score ?? ""));
  const [feedback, setFeedback] = React.useState(submission.feedback ?? "");
  const [decision, setDecision] = React.useState(submission.passed == null ? "unset" : submission.passed ? "pass" : "fail");

  return (
    <TableRow>
      <TableCell className="font-semibold">
        {submission.studentName ?? `Student #${submission.userId}`}
      </TableCell>
      <TableCell className="max-w-[320px]">
        {submission.content ? (
          <p className="text-sm text-foreground break-words line-clamp-3 whitespace-pre-wrap">
            {submission.content}
          </p>
        ) : null}
        {submission.fileUrl ? (
          <Button asChild variant="link" className="p-0 h-auto text-xs text-primary mt-1">
            <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer">
              View attached file
            </a>
          </Button>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(submission.submittedAt)}</TableCell>
      <TableCell>
        <StatusBadge status={submission.status} />
      </TableCell>
      <TableCell>
        <div className="grid gap-2 py-2">
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger aria-label={`Pass decision for ${submission.studentName ?? submission.userId}`}>
              <SelectValue placeholder="Choose pass or fail" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Choose pass or fail</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <div className="grid gap-1 flex-1">
              <Label className="text-[10px] text-muted-foreground">Score</Label>
              <Input
                type="number"
                min="0"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
                className="h-8"
              />
            </div>
            <div className="grid gap-1 flex-[3]">
              <Label className="text-[10px] text-muted-foreground">Feedback notes</Label>
              <Input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Clear explanation, next step, or correction"
                className="h-8"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onGrade(Number(score), feedback, decision === "pass")}
            disabled={!score || decision === "unset" || isSubmitting}
            className="w-full h-8"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Grade
          </Button>
          {submission.status !== "RETURNED" && submission.passed !== true ? (
            <Button size="sm" variant="outline" onClick={() => onReturn(feedback)} disabled={!feedback.trim() || isSubmitting}>
              Return for revision
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
