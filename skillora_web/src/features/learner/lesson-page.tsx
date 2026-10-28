"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, ArrowLeft, BookOpen, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AskAiButton } from "@/components/ask-ai-button";
import { AppShell } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { learnerApi } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { LessonVideo } from "@/lib/types";

export function LessonPage({ lessonId, enrollmentId }: { lessonId: number; enrollmentId?: number }) {
  const queryClient = useQueryClient();

  const lesson = useQuery({
    queryKey: queryKeys.lesson(lessonId),
    queryFn: () => learnerApi.getLesson(lessonId),
  });

  const markDone = useMutation({
    mutationFn: () =>
      learnerApi.markLessonProgress(enrollmentId!, lessonId, {
        watchedSeconds: lesson.data?.durationSeconds ?? 0,
        completed: true,
      }),
    onSuccess: () => {
      toast.success("Lesson marked as complete");
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollmentProgress(enrollmentId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollmentsRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningDashboard });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const lessonData = lesson.data;

  return (
    <AppShell>
      <div className="space-y-4 max-w-[1280px] mx-auto">
        {/* Back Link */}
        {enrollmentId ? (
          <Link
            href={`/learn/${enrollmentId}`}
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-primary transition-all duration-200"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Curriculum
          </Link>
        ) : null}

        {lesson.isLoading ? <PageSkeleton rows={4} /> : null}
        {lesson.isError ? (
          <ErrorState
            message={(lesson.error as Error).message}
            onRetry={() => lesson.refetch()}
          />
        ) : null}

        {lessonData ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <section className="space-y-5">
              <PageHeader
                title={lessonData.title}
                description={`${lessonData.preview ? "Preview Lesson" : "Protected Lesson"} &bull; ${formatDuration(lessonData.durationSeconds)}`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <AskAiButton
                      courseId={lessonData.courseId}
                      label="Ask AI Helper"
                      prompt={`Help me understand the lesson "${lessonData.title}". Give me a concise summary, key terms, and two practice questions.`}
                      variant="outline"
                      className="text-xs h-9 rounded-[--radius-button]"
                    />
                    {enrollmentId && lessonData.type !== "QUIZ" && lessonData.type !== "ASSIGNMENT" ? (
                      <Button onClick={() => markDone.mutate()} disabled={markDone.isPending} className="text-xs h-9 font-semibold rounded-[--radius-button]">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Complete
                      </Button>
                    ) : null}
                  </div>
                }
              />

              <Card className="overflow-hidden border border-border/70 rounded-[--radius-card] shadow-lg">
                <CardContent className="p-0">
                  <div className="aspect-video bg-zinc-950 text-zinc-100 flex items-center justify-center relative shadow-inner">
                    {lessonData.video?.status === "READY" && lessonData.video.embedUrl ? (
                      <iframe
                        src={lessonData.video.embedUrl}
                        title={lessonData.title}
                        className="h-full w-full border-0"
                        loading="lazy"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;"
                        allowFullScreen
                      />
                    ) : (lessonData.video?.playbackUrl ?? lessonData.videoUrl)
                      && (lessonData.video?.status === "READY" || !lessonData.video?.status) ? (
                      <video
                        src={lessonData.video?.playbackUrl ?? lessonData.videoUrl ?? undefined}
                        className="h-full w-full object-contain"
                        controls
                        controlsList="nodownload"
                      />
                    ) : (
                      <VideoState video={lessonData.video} />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Lesson Written Content */}
              <Card className="border border-border/70 rounded-[--radius-card]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-foreground">Lesson Notes</CardTitle>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-muted-foreground/90 whitespace-pre-wrap">
                  {lessonData.content ?? "The instructor has not added written notes for this lesson."}
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-4">
              {/* Resources Panel */}
              <Card className="border border-border/70 rounded-[--radius-card]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold text-foreground">Resources</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {lessonData.resources?.length ? (
                    lessonData.resources.map((resource) => (
                      <Button key={resource.id} asChild variant="outline" className="justify-start text-xs h-9 rounded-[--radius-button] border-border/70 text-muted-foreground hover:text-foreground">
                        <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" download>
                          <FileText className="mr-2.5 h-4 w-4 text-primary shrink-0" />
                          <span className="truncate font-medium">{resource.name}</span>
                        </a>
                      </Button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground/70">No extra files are attached.</p>
                  )}
                </CardContent>
              </Card>

              {/* Practice Panel (Quiz / Assignment) */}
              <Card className="border border-border/70 rounded-[--radius-card]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold text-foreground">Practice Tasks</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {lessonData.quizId ? (
                    <Button asChild className="w-full text-xs h-9 font-semibold rounded-[--radius-button]">
                      <Link href={`/quizzes/${lessonData.quizId}`}>
                        <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
                        Start Lesson Quiz
                      </Link>
                    </Button>
                  ) : null}
                  {lessonData.assignmentId ? (
                    <Button asChild variant="outline" className="w-full text-xs h-9 font-semibold rounded-[--radius-button] border-border/70 text-muted-foreground hover:text-foreground">
                      <Link href={`/assignments/${lessonData.assignmentId}`}>
                        <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                        Submit Assignment
                      </Link>
                    </Button>
                  ) : null}
                  {!lessonData.quizId && !lessonData.assignmentId ? (
                    <p className="text-xs text-muted-foreground/70">No linked practice tasks.</p>
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

function VideoState({ video }: { video?: LessonVideo | null }) {
  if (video?.status === "UPLOADING" || video?.status === "PROCESSING") {
    return (
      <div className="flex flex-col items-center gap-2.5 text-muted-foreground/80">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/40" />
        <span className="text-xs font-semibold">Video is processing</span>
      </div>
    );
  }

  if (video?.status === "FAILED") {
    return (
      <div className="flex flex-col items-center gap-2.5 text-muted-foreground/80">
        <AlertCircle className="h-10 w-10 text-destructive/70" />
        <span className="text-xs font-semibold">Video processing failed</span>
        {video.errorMessage ? (
          <span className="max-w-md text-center text-[11px] text-muted-foreground">{video.errorMessage}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2.5 text-muted-foreground/80">
      <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
      <span className="text-xs font-semibold">No video attached to this lesson</span>
    </div>
  );
}
