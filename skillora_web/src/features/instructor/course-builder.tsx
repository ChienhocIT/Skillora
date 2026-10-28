"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  FileCheck,
  FileText,
  GitBranch,
  Info,
  LayoutGrid,
  Loader2,
  MinusCircle,
  Plus,
  PlusCircle,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import * as tus from "tus-js-client";
import { toast } from "sonner";

import { AskAiButton } from "@/components/ask-ai-button";
import { AppShell } from "@/components/app-shell";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CategoryPicker } from "@/features/instructor/course-create";
import { courseApi, instructorApi, learnerApi, practiceApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { Course, CourseLevel, CourseVersion, LessonResource, Question, Quiz, Section, VideoStatus } from "@/lib/types";

function csv(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

type LessonKind = "VIDEO" | "TEXT" | "QUIZ" | "ASSIGNMENT";

const lessonTypes: Array<{ label: string; value: LessonKind }> = [
  { label: "Video", value: "VIDEO" },
  { label: "Text", value: "TEXT" },
  { label: "Quiz", value: "QUIZ" },
  { label: "Assignment", value: "ASSIGNMENT" },
];

type BuilderLesson = NonNullable<Section["lessons"]>[number];

function requiresReadyVideo(lesson: BuilderLesson) {
  return (lesson.type ?? "VIDEO") === "VIDEO" && lesson.published !== false;
}

function videoReadyForReview(lesson: BuilderLesson) {
  return !requiresReadyVideo(lesson) || (lesson.hasVideo === true && lesson.videoStatus === "READY");
}

function isProcessingVideoStatus(status?: VideoStatus | null) {
  return status === "UPLOADING" || status === "PROCESSING";
}

function videoStatusLabel(status?: VideoStatus | null, hasVideo?: boolean) {
  if (!hasVideo && !status) {
    return "Missing";
  }
  if (status === "READY") {
    return "Ready";
  }
  if (status === "FAILED") {
    return "Failed";
  }
  if (status === "UPLOADING") {
    return "Uploading";
  }
  if (status === "PROCESSING") {
    return "Processing";
  }
  return status ?? "Missing";
}

function videoStatusVariant(status?: VideoStatus | null, hasVideo?: boolean): "default" | "secondary" | "destructive" | "outline" {
  if (status === "READY") {
    return "default";
  }
  if (status === "FAILED" || (!hasVideo && !status)) {
    return "destructive";
  }
  if (isProcessingVideoStatus(status)) {
    return "secondary";
  }
  return "outline";
}

export function CourseBuilderPage({ courseId }: { courseId: number }) {
  const queryClient = useQueryClient();

  const course = useQuery({
    queryKey: queryKeys.builderCourse(courseId),
    queryFn: () => courseApi.getById(courseId),
  });

  const sections = useQuery({
    queryKey: queryKeys.builderSections(courseId),
    queryFn: () => courseApi.getSections(courseId),
    enabled: Boolean(courseId),
  });

  const submitReview = useMutation({
    mutationFn: () => instructorApi.submitReview(courseId),
    onSuccess: () => {
      toast.success("Course submitted for admin review");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCoursesRoot });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const hasSection = (sections.data?.length ?? 0) > 0;
  const lessonCount =
    sections.data?.reduce((total, s) => total + (s.lessons?.length ?? 0), 0) ?? 0;
  const publishedVideoLessons =
    sections.data
      ?.filter((section) => section.published !== false)
      .flatMap((section) => section.lessons ?? [])
      .filter(requiresReadyVideo) ?? [];
  const videoLessonsReady = publishedVideoLessons.every(videoReadyForReview);
  const nextSectionOrder =
    Math.max(
      -1,
      ...(sections.data ?? []).map((s) => s.orderIndex ?? s.position ?? 0),
    ) + 1;

  const readiness = [
    { label: "Title", ready: Boolean(course.data?.title?.trim()) },
    { label: "Description", ready: Boolean(course.data?.description?.trim()) },
    { label: "At least one section", ready: hasSection },
    { label: "At least one lesson", ready: lessonCount > 0 },
    { label: "Video lessons ready", ready: videoLessonsReady },
  ];

  const readyToSubmit = readiness.every((item) => item.ready);
  const liveLocked = course.data?.status === "PUBLISHED";

  const courseData = course.data;

  return (
    <AppShell>
      {course.isLoading ? <PageSkeleton rows={4} /> : null}
      {course.isError ? (
        <ErrorState
          message={(course.error as Error).message}
          onRetry={() => course.refetch()}
        />
      ) : null}

      {courseData ? (
        <div className="space-y-6">
          <PageHeader
            title={courseData.title}
            description={
              liveLocked
                ? "This course is published and metadata is locked. Create a version draft to propose edits."
                : "Organize sections, write lessons, add resources, and submit for review."
            }
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge status={courseData.status} />
                {!liveLocked && courseData.status !== "REVIEWING" ? (
                  <Button
                    disabled={!readyToSubmit || submitReview.isPending}
                    onClick={() => submitReview.mutate()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Review
                  </Button>
                ) : null}
              </div>
            }
          />

          {courseData.rejectReason ? (
            <Card className="border-destructive bg-destructive/5 text-destructive p-4 flex gap-3 items-start text-sm">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Rejection Reason</p>
                <p className="text-muted-foreground mt-0.5">{courseData.rejectReason}</p>
              </div>
            </Card>
          ) : null}

          <Tabs defaultValue="curriculum" className="space-y-6">
            <TabsList>
              <TabsTrigger value="curriculum" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Curriculum
              </TabsTrigger>
              <TabsTrigger value="metadata" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Metadata
              </TabsTrigger>
              {liveLocked ? (
                <TabsTrigger value="versions" className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Versions
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="curriculum" className="grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                {sections.isLoading ? <PageSkeleton rows={4} /> : null}
                {sections.isError ? (
                  <ErrorState
                    message={(sections.error as Error).message}
                    onRetry={() => sections.refetch()}
                  />
                ) : null}
                {sections.data?.map((section) =>
                  liveLocked ? (
                    <ReadOnlySectionCard key={section.id} section={section} />
                  ) : (
                    <Card key={section.id}>
                      <CardHeader className="pb-3 border-b">
                        <EditableSectionHeader
                          section={section}
                          courseId={courseId}
                        />
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <LessonCreator
                          sectionId={section.id}
                          courseId={courseId}
                          nextOrderIndex={
                            Math.max(
                              -1,
                              ...(section.lessons ?? []).map(
                                (lesson) => lesson.orderIndex ?? lesson.position ?? 0,
                              ),
                            ) + 1
                          }
                        />
                        {section.lessons?.length ? <Separator /> : null}
                        {(section.lessons ?? []).map((lesson) => (
                          <EditableLessonRow
                            key={lesson.id}
                            lesson={lesson}
                            courseId={courseId}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  ),
                )}
                {sections.isSuccess && sections.data?.length === 0 ? (
                  <EmptyState
                    title="Curriculum is empty"
                    message="Add your first section module on the right side to start building curriculum."
                  />
                ) : null}
              </div>

              <aside className="space-y-4">
                <AiDraftHelper courseId={courseId} courseTitle={courseData.title} />
                {liveLocked ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Course is Live</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground leading-relaxed">
                      Curriculum modifications are restricted once a course is published. Use the versioning flow to submit content revisions.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Publish Checklist</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        {readiness.map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <Badge variant={item.ready ? "default" : "secondary"}>
                              {item.ready ? "Ready" : "Missing"}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <SectionCreator courseId={courseId} nextOrderIndex={nextSectionOrder} />
                  </>
                )}
              </aside>
            </TabsContent>

            <TabsContent value="metadata">
              {liveLocked ? (
                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground bg-muted/20">
                  Course metadata is locked. Review versions tab to submit new metadata drafts.
                </div>
              ) : (
                <CourseMetadataEditor course={courseData} />
              )}
            </TabsContent>

            {liveLocked ? (
              <TabsContent value="versions">
                <CourseVersionPanel course={courseData} />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      ) : null}
    </AppShell>
  );
}

function AiDraftHelper({
  courseId,
  courseTitle,
}: {
  courseId: number;
  courseTitle: string;
}) {
  const prompts = [
    {
      label: "Draft outline",
      prompt: `Draft a concise course outline for "${courseTitle}" with section goals and lesson ideas. Keep it practical for Skillora learners.`,
    },
    {
      label: "Quiz ideas",
      prompt: `Suggest quiz questions for "${courseTitle}" with answer options and short explanations. Do not create or update course data automatically.`,
    },
    {
      label: "Assignment brief",
      prompt: `Write a learner-friendly assignment brief for "${courseTitle}" with objective, submission format, grading criteria, and common mistakes.`,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Draft Helper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p>
          Ask Skillora AI for drafts, then copy or adapt the result manually into your course builder.
        </p>
        <div className="grid gap-2">
          {prompts.map((item) => (
            <AskAiButton
              key={item.label}
              className="w-full justify-start"
              courseId={courseId}
              label={item.label}
              prompt={item.prompt}
              variant="outline"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* Metadata Tab Editor */
function CourseMetadataEditor({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(course.title ?? "");
  const [subtitle, setSubtitle] = React.useState(course.subtitle ?? "");
  const [description, setDescription] = React.useState(course.description ?? "");
  const [level, setLevel] = React.useState<CourseLevel>(course.level ?? "BEGINNER");
  const [price, setPrice] = React.useState(String(course.price ?? 0));
  const [thumbnailUrl, setThumbnailUrl] = React.useState(course.thumbnailUrl ?? "");
  const [categoryIds, setCategoryIds] = React.useState<number[]>(
    (course.categories ?? []).map((cat) => cat.id),
  );
  const [requirements, setRequirements] = React.useState(
    (course.requirements ?? []).join("\n"),
  );
  const [outcomes, setOutcomes] = React.useState((course.outcomes ?? []).join("\n"));

  const update = useMutation({
    mutationFn: () =>
      instructorApi.updateCourse(course.id, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        level,
        price: Number(price),
        currency: course.currency ?? "VND",
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        categoryIds,
        requirements: csv(requirements),
        outcomes: csv(outcomes),
      }),
    onSuccess: () => {
      toast.success("Course metadata updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(course.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorCoursesRoot });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle">Subtitle</Label>
            <Input id="edit-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(val) => setLevel(val as CourseLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BEGINNER">Beginner</SelectItem>
                <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                <SelectItem value="ADVANCED">Advanced</SelectItem>
                <SelectItem value="ALL_LEVELS">All levels</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-price">Price (VND)</Label>
            <Input id="edit-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-thumbnail">Thumbnail Image URL</Label>
            <Input id="edit-thumbnail" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
          </div>
        </div>

        <CategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-requirements">Requirements (one per line)</Label>
            <Textarea
              id="edit-requirements"
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-outcomes">Outcomes (one per line)</Label>
            <Textarea
              id="edit-outcomes"
              rows={4}
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
            />
          </div>
        </div>

        <Button
          className="w-fit"
          disabled={!title.trim() || !description.trim() || update.isPending}
          onClick={() => update.mutate()}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Metadata
        </Button>
      </CardContent>
    </Card>
  );
}

/* Sections and Lessons creators */
function SectionCreator({
  courseId,
  nextOrderIndex = 0,
}: {
  courseId: number;
  nextOrderIndex?: number;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState("");
  const [orderIndex, setOrderIndex] = React.useState(String(nextOrderIndex));
  const [published, setPublished] = React.useState(true);

  const create = useMutation({
    mutationFn: () =>
      instructorApi.createSection(courseId, {
        title: title.trim(),
        orderIndex: Number(orderIndex),
        published,
    }),
    onSuccess: () => {
      setTitle("");
      setOrderIndex((current) => String(Number(current || 0) + 1));
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
      toast.success("Section module added");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Add Section Module</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs">
        <div className="grid gap-1.5">
          <Label htmlFor="sectionTitle">Title</Label>
          <Input
            id="sectionTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 1: Introduction"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sectionOrder">Order Position</Label>
          <Input
            id="sectionOrder"
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox checked={published} onCheckedChange={(checked) => setPublished(Boolean(checked))} />
          <span>Published immediately</span>
        </label>
        <Button
          size="sm"
          className="w-full mt-1"
          disabled={!title.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Add Section
        </Button>
      </CardContent>
    </Card>
  );
}

function LessonCreator({
  sectionId,
  courseId,
  nextOrderIndex = 0,
}: {
  sectionId: number;
  courseId: number;
  nextOrderIndex?: number;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<LessonKind>("VIDEO");
  const [durationSeconds, setDurationSeconds] = React.useState("0");
  const [orderIndex, setOrderIndex] = React.useState(String(nextOrderIndex));
  const [preview, setPreview] = React.useState(false);

  const create = useMutation({
    mutationFn: () =>
      instructorApi.createLesson(sectionId, {
        title: title.trim(),
        type,
        durationSeconds: Number(durationSeconds),
        orderIndex: Number(orderIndex),
        preview,
        published: true,
    }),
    onSuccess: () => {
      setTitle("");
      setType("VIDEO");
      setOrderIndex((current) => String(Number(current || 0) + 1));
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
      toast.success("Lesson added");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="grid gap-2 rounded-md border p-3 bg-muted/10 text-xs">
      <Label className="font-semibold">Add New Lesson</Label>
      <div className="grid gap-2 md:grid-cols-[1fr_130px_120px_96px_auto_auto] items-end">
        <div className="grid gap-1">
          <Label htmlFor={`lesson-title-${sectionId}`}>Title</Label>
          <Input
            id={`lesson-title-${sectionId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lesson 1: Welcome"
          />
        </div>
        <div className="grid gap-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as LessonKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lessonTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`lesson-seconds-${sectionId}`}>Seconds</Label>
          <Input
            id={`lesson-seconds-${sectionId}`}
            type="number"
            min="0"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`lesson-order-${sectionId}`}>Order</Label>
          <Input
            id={`lesson-order-${sectionId}`}
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer pb-2.5">
          <Checkbox checked={preview} onCheckedChange={(checked) => setPreview(Boolean(checked))} />
          <span>Previewable</span>
        </label>
        <Button
          size="sm"
          disabled={!title.trim() || create.isPending}
          onClick={() => create.mutate()}
          className="h-10"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Lesson
        </Button>
      </div>
    </div>
  );
}

function EditableSectionHeader({ section, courseId }: { section: Section; courseId: number }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(section.title);
  const [orderIndex, setOrderIndex] = React.useState(
    String(section.orderIndex ?? section.position ?? 0),
  );
  const [published, setPublished] = React.useState(section.published ?? true);

  const update = useMutation({
    mutationFn: () =>
      instructorApi.updateSection(section.id, {
        title: title.trim(),
        description: section.description,
        orderIndex: Number(orderIndex),
        published,
      }),
    onSuccess: () => {
      toast.success("Section module updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: () => instructorApi.deleteSection(section.id),
    onSuccess: () => {
      toast.success("Section module deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_96px_auto_auto_auto] items-end text-xs">
      <div className="grid gap-1.5 flex-1">
        <Label htmlFor={`section-name-${section.id}`}>Section Title</Label>
        <Input id={`section-name-${section.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-1.5 w-24">
        <Label htmlFor={`section-pos-${section.id}`}>Position</Label>
        <Input
          id={`section-pos-${section.id}`}
          type="number"
          min="0"
          value={orderIndex}
          onChange={(e) => setOrderIndex(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer pb-2.5">
        <Checkbox checked={published} onCheckedChange={(checked) => setPublished(Boolean(checked))} />
        <span>Published</span>
      </label>
      <div className="flex gap-2 pb-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          disabled={!title.trim() || update.isPending}
          onClick={() => update.mutate()}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save
        </Button>
        <ConfirmActionDialog
          title="Delete Section?"
          description={`Are you sure you want to delete "${section.title}"? All attached lessons will also be deleted.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => remove.mutate()}
          disabled={remove.isPending}
          trigger={
            <Button size="sm" variant="destructive">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          }
        />
      </div>
    </div>
  );
}

function EditableLessonRow({
  lesson,
  courseId,
}: {
  lesson: NonNullable<Section["lessons"]>[number];
  courseId: number;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(lesson.title);
  const [lessonType, setLessonType] = React.useState<LessonKind>((lesson.type as LessonKind) ?? "VIDEO");
  const [durationSeconds, setDurationSeconds] = React.useState(String(lesson.durationSeconds ?? 0));
  const [orderIndex, setOrderIndex] = React.useState(
    String(lesson.orderIndex ?? lesson.position ?? 0),
  );
  const [preview, setPreview] = React.useState(Boolean(lesson.preview));
  const [published, setPublished] = React.useState(lesson.published ?? true);
  const [contentDraft, setContentDraft] = React.useState<string | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [awaitingProcessing, setAwaitingProcessing] = React.useState(false);

  const fullLesson = useQuery({
    queryKey: queryKeys.lesson(lesson.id),
    queryFn: () => learnerApi.getLesson(lesson.id),
  });
  const { refetch: refetchFullLesson } = fullLesson;
  const refetchLesson = React.useCallback(async () => {
    const result = await refetchFullLesson();
    if (result.data?.video?.status === "READY" || result.data?.video?.status === "FAILED") {
      setAwaitingProcessing(false);
    }
  }, [refetchFullLesson]);

  const contentValue = contentDraft ?? fullLesson.data?.content ?? "";
  const backendVideoStatus = fullLesson.data?.video?.status ?? lesson.videoStatus ?? null;
  const hasBackendVideo = Boolean(fullLesson.data?.video ?? lesson.hasVideo);
  const videoStatus = awaitingProcessing && backendVideoStatus !== "READY" && backendVideoStatus !== "FAILED"
    ? "PROCESSING"
    : backendVideoStatus;
  const hasVideo = hasBackendVideo || awaitingProcessing;

  React.useEffect(() => {
    if (!isProcessingVideoStatus(videoStatus)) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refetchLesson();
      void queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [courseId, queryClient, refetchLesson, videoStatus]);

  const update = useMutation({
    mutationFn: () =>
      instructorApi.updateLesson(lesson.id, {
        title: title.trim(),
        type: lessonType,
        content: contentValue.trim() || undefined,
        durationSeconds: Number(durationSeconds),
        preview,
        published,
        orderIndex: Number(orderIndex),
      }),
    onSuccess: () => {
      toast.success("Lesson updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: () => instructorApi.deleteLesson(lesson.id),
    onSuccess: () => {
      toast.success("Lesson deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const uploadVideo = useMutation({
    mutationFn: async (file: File) => {
      const ticket = await instructorApi.getUploadUrl(lesson.id, {
        fileName: file.name,
        mimeType: file.type || "video/mp4",
        fileSizeBytes: file.size,
      });

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: ticket.uploadUrl,
          headers: ticket.headers,
          metadata: ticket.metadata,
          retryDelays: [0, 1000, 3000, 5000],
          onError: reject,
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success(`Video upload completed. Processing video ${ticket.videoId}.`);
      setAwaitingProcessing(true);
      setUploadProgress(null);
      setVideoFile(null);
      void refetchLesson();
      void queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
    },
    onError: (error) => {
      setUploadProgress(null);
      toast.error("Upload error: " + (error as Error).message);
    },
  });

  return (
    <div className="grid gap-3 rounded-lg border p-4 bg-card/60 text-xs">
      <div className="grid gap-3 md:grid-cols-[1fr_130px_120px_96px_auto_auto] items-end">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor={`lesson-title-input-${lesson.id}`}>Lesson Title</Label>
          <Input id={`lesson-title-input-${lesson.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <Select value={lessonType} onValueChange={(value) => setLessonType(value as LessonKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lessonTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 w-28">
          <Label htmlFor={`lesson-dur-${lesson.id}`}>Duration (sec)</Label>
          <Input
            id={`lesson-dur-${lesson.id}`}
            type="number"
            min="0"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 w-24">
          <Label htmlFor={`lesson-idx-${lesson.id}`}>Order</Label>
          <Input
            id={`lesson-idx-${lesson.id}`}
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer pb-2.5">
          <Checkbox checked={preview} onCheckedChange={(checked) => setPreview(Boolean(checked))} />
          <span>Previewable</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer pb-2.5">
          <Checkbox checked={published} onCheckedChange={(checked) => setPublished(Boolean(checked))} />
          <span>Published</span>
        </label>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`lesson-content-${lesson.id}`}>Written Content</Label>
        <Textarea
          id={`lesson-content-${lesson.id}`}
          rows={4}
          value={contentValue}
          onChange={(event) => setContentDraft(event.target.value)}
          placeholder="Add lesson notes, reading material, or setup steps..."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
        <PracticeCreator
          lessonId={lesson.id}
          courseId={courseId}
          lessonType={lessonType}
          quizId={lesson.quizId ?? fullLesson.data?.quizId ?? null}
          assignmentId={lesson.assignmentId ?? fullLesson.data?.assignmentId ?? null}
        />
        
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`lesson-video-file-${lesson.id}`} className="text-[10px] text-muted-foreground">
              Video file
            </Label>
            <Input
              id={`lesson-video-file-${lesson.id}`}
              type="file"
              accept="video/*"
              className="h-8 max-w-56 text-xs"
              onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!videoFile) {
                toast.error("Choose a video file first");
                return;
              }
              uploadVideo.mutate(videoFile);
            }}
            disabled={lessonType !== "VIDEO" || !videoFile || uploadVideo.isPending}
          >
            {uploadVideo.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <UploadCloud className="mr-1 h-3.5 w-3.5 shrink-0" />
            )}
            Upload Video
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/lessons/${lesson.id}`}>
              <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0" />
              Preview
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!title.trim() || update.isPending}
            onClick={() => update.mutate()}
          >
            <Save className="mr-1 h-3.5 w-3.5 shrink-0" />
            Save
          </Button>
          <ConfirmActionDialog
            title="Delete Lesson?"
            description={`Are you sure you want to delete lesson "${lesson.title}"? This action is permanent.`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => remove.mutate()}
            disabled={remove.isPending}
            trigger={
              <Button size="sm" variant="destructive">
                <Trash2 className="mr-1 h-3.5 w-3.5 shrink-0" />
                Delete
              </Button>
            }
          />
        </div>
      </div>
      {uploadProgress !== null ? (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Uploading video to Bunny Stream</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      ) : null}
      {lessonType === "VIDEO" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/10 px-3 py-2">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">
            Video status
          </span>
          <Badge variant={videoStatusVariant(videoStatus, hasVideo)}>
            {videoStatusLabel(videoStatus, hasVideo)}
          </Badge>
        </div>
      ) : null}
      <LessonResourceManager
        lessonId={lesson.id}
        courseId={courseId}
        resources={fullLesson.data?.resources ?? []}
        loading={fullLesson.isLoading}
        onChanged={() => fullLesson.refetch()}
      />
    </div>
  );
}

const resourceTypes = ["PDF", "ZIP", "LINK", "CODE", "IMAGE", "OTHER"] as const;

function LessonResourceManager({
  lessonId,
  courseId,
  resources,
  loading,
  onChanged,
}: {
  lessonId: number;
  courseId: number;
  resources: LessonResource[];
  loading: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [resourceType, setResourceType] = React.useState("PDF");
  const [sizeBytes, setSizeBytes] = React.useState("");
  const [orderIndex, setOrderIndex] = React.useState("0");

  const invalidate = () => {
    onChanged();
    queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
  };

  const create = useMutation({
    mutationFn: () =>
      instructorApi.createResource(lessonId, {
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        resourceType,
        sizeBytes: sizeBytes ? Number(sizeBytes) : 0,
        orderIndex: Number(orderIndex || 0),
      }),
    onSuccess: () => {
      toast.success("Resource added");
      setName("");
      setFileUrl("");
      setSizeBytes("");
      setOrderIndex((current) => String(Number(current || 0) + 1));
      invalidate();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="grid gap-3 rounded-md border bg-muted/10 p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold">Lesson Resources</p>
      </div>
      {loading ? <PageSkeleton rows={2} /> : null}
      <div className="grid gap-2 md:grid-cols-[1fr_1.3fr_120px_120px_88px_auto] items-end text-xs">
        <div className="grid gap-1">
          <Label htmlFor={`resource-name-${lessonId}`}>Name</Label>
          <Input id={`resource-name-${lessonId}`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`resource-url-${lessonId}`}>File URL</Label>
          <Input id={`resource-url-${lessonId}`} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Type</Label>
          <Select value={resourceType} onValueChange={setResourceType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {resourceTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`resource-size-${lessonId}`}>Bytes</Label>
          <Input
            id={`resource-size-${lessonId}`}
            type="number"
            min="0"
            value={sizeBytes}
            onChange={(e) => setSizeBytes(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`resource-order-${lessonId}`}>Order</Label>
          <Input
            id={`resource-order-${lessonId}`}
            type="number"
            min="0"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!name.trim() || !fileUrl.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {resources.length ? (
        <div className="grid gap-2">
          {resources
            .slice()
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((resource) => (
              <EditableResourceRow
                key={resource.id}
                resource={resource}
                onChanged={invalidate}
              />
            ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No downloadable resources yet.</p>
      )}
    </div>
  );
}

function EditableResourceRow({
  resource,
  onChanged,
}: {
  resource: LessonResource;
  onChanged: () => void;
}) {
  const [name, setName] = React.useState(resource.name);
  const [fileUrl, setFileUrl] = React.useState(resource.fileUrl);
  const [resourceType, setResourceType] = React.useState(resource.resourceType ?? "PDF");
  const [sizeBytes, setSizeBytes] = React.useState(String(resource.sizeBytes ?? 0));
  const [orderIndex, setOrderIndex] = React.useState(String(resource.orderIndex ?? 0));

  const update = useMutation({
    mutationFn: () =>
      instructorApi.updateResource(resource.id, {
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        resourceType,
        sizeBytes: Number(sizeBytes || 0),
        orderIndex: Number(orderIndex || 0),
      }),
    onSuccess: () => {
      toast.success("Resource updated");
      onChanged();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: () => instructorApi.deleteResource(resource.id),
    onSuccess: () => {
      toast.success("Resource deleted");
      onChanged();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="grid gap-2 rounded-md border bg-card p-2 md:grid-cols-[1fr_1.4fr_110px_100px_80px_auto] items-end text-xs">
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Resource name" />
      <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} aria-label="Resource URL" />
      <Select value={resourceType} onValueChange={setResourceType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {resourceTypes.map((type) => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min="0"
        value={sizeBytes}
        onChange={(e) => setSizeBytes(e.target.value)}
        aria-label="Resource size bytes"
      />
      <Input
        type="number"
        min="0"
        value={orderIndex}
        onChange={(e) => setOrderIndex(e.target.value)}
        aria-label="Resource order"
      />
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" disabled={!name.trim() || !fileUrl.trim() || update.isPending} onClick={() => update.mutate()}>
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PracticeCreator({
  lessonId,
  courseId,
  lessonType,
  quizId,
  assignmentId,
}: {
  lessonId: number;
  courseId: number;
  lessonType: LessonKind;
  quizId?: number | null;
  assignmentId?: number | null;
}) {
  return (
    <div className="grid w-full gap-3 text-xs">
      {(lessonType === "QUIZ" || quizId) ? (
        <QuizEditorPanel lessonId={lessonId} courseId={courseId} quizId={quizId} />
      ) : null}
      {(lessonType === "ASSIGNMENT" || assignmentId) ? (
        <AssignmentCreatorPanel
          lessonId={lessonId}
          courseId={courseId}
          assignmentId={assignmentId}
        />
      ) : null}
    </div>
  );
}

type QuestionDraft = {
  content: string;
  type: "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "TEXT";
  points: string;
  orderIndex: string;
  explanation: string;
  answerOptions: Array<{ content: string; correct: boolean; orderIndex: string }>;
};

function blankQuestion(orderIndex = 0): QuestionDraft {
  return {
    content: "",
    type: "SINGLE",
    points: "1",
    orderIndex: String(orderIndex),
    explanation: "",
    answerOptions: [
      { content: "", correct: true, orderIndex: "0" },
      { content: "", correct: false, orderIndex: "1" },
    ],
  };
}

function questionFromResponse(question: Question, index: number): QuestionDraft {
  return {
    content: question.content ?? question.text ?? "",
    type: (question.type as QuestionDraft["type"]) ?? "SINGLE",
    points: String(question.points ?? 1),
    orderIndex: String((question as { orderIndex?: number }).orderIndex ?? index),
    explanation: question.explanation ?? "",
    answerOptions: (question.answerOptions ?? question.options ?? []).map((option, optionIndex) => ({
      content: option.content ?? option.text ?? "",
      correct: Boolean(option.correct),
      orderIndex: String((option as { orderIndex?: number }).orderIndex ?? optionIndex),
    })),
  };
}

function quizPayload(lessonId: number, title: string, description: string, passScore: string, timeLimitMins: string, maxAttempts: string, shuffleQuestions: boolean, questions: QuestionDraft[]) {
  return {
    lessonId,
    title: title.trim(),
    description: description.trim() || undefined,
    passScore: Number(passScore || 0),
    timeLimitMins: timeLimitMins ? Number(timeLimitMins) : undefined,
    maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
    shuffleQuestions,
    questions: questions.map((question, index) => ({
      content: question.content.trim(),
      type: question.type,
      points: Number(question.points || 1),
      orderIndex: Number(question.orderIndex || index),
      explanation: question.explanation.trim() || undefined,
      answerOptions: question.type === "TEXT"
        ? []
        : question.answerOptions.map((option, optionIndex) => ({
            content: option.content.trim(),
            correct: option.correct,
            orderIndex: Number(option.orderIndex || optionIndex),
          })),
    })),
  };
}

function QuizEditorPanel({
  lessonId,
  courseId,
  quizId,
}: {
  lessonId: number;
  courseId: number;
  quizId?: number | null;
}) {
  const quiz = useQuery({
    queryKey: quizId ? queryKeys.quiz(quizId) : ["quiz-draft", lessonId],
    queryFn: () => practiceApi.getQuiz(quizId!),
    enabled: Boolean(quizId),
  });

  if (quizId && quiz.isLoading) {
    return (
      <div className="rounded-md border bg-muted/10 p-3">
        <PageSkeleton rows={2} />
      </div>
    );
  }

  if (quizId && quiz.isError) {
    return (
      <div className="rounded-md border bg-muted/10 p-3">
        <ErrorState message={(quiz.error as Error).message} onRetry={() => quiz.refetch()} />
      </div>
    );
  }

  return (
    <QuizFormPanel
      key={quizId ? `quiz-${quizId}-${quiz.data?.updatedAt ?? ""}` : `new-${lessonId}`}
      lessonId={lessonId}
      courseId={courseId}
      quizId={quizId}
      initialQuiz={quiz.data ?? null}
    />
  );
}

function QuizFormPanel({
  lessonId,
  courseId,
  quizId,
  initialQuiz,
}: {
  lessonId: number;
  courseId: number;
  quizId?: number | null;
  initialQuiz: (Quiz & { updatedAt?: string; shuffleQuestions?: boolean }) | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(initialQuiz?.title ?? "");
  const [description, setDescription] = React.useState(initialQuiz?.description ?? "");
  const [passScore, setPassScore] = React.useState(String(initialQuiz?.passScore ?? initialQuiz?.passingScore ?? 80));
  const [timeLimitMins, setTimeLimitMins] = React.useState(initialQuiz?.timeLimitMins ? String(initialQuiz.timeLimitMins) : "");
  const [maxAttempts, setMaxAttempts] = React.useState(initialQuiz?.maxAttempts ? String(initialQuiz.maxAttempts) : "");
  const [shuffleQuestions, setShuffleQuestions] = React.useState(Boolean(initialQuiz?.shuffleQuestions));
  const [questions, setQuestions] = React.useState<QuestionDraft[]>(
    initialQuiz?.questions?.length ? initialQuiz.questions.map(questionFromResponse) : [blankQuestion()],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    if (quizId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz(quizId) });
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const body = quizPayload(lessonId, title, description, passScore, timeLimitMins, maxAttempts, shuffleQuestions, questions);
      return quizId ? instructorApi.updateQuiz(quizId, body) : instructorApi.createQuiz(body);
    },
    onSuccess: () => {
      toast.success(quizId ? "Quiz updated" : "Quiz created");
      invalidate();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const valid = Boolean(
    title.trim() &&
    questions.length > 0 &&
    questions.every((question) =>
      question.content.trim() &&
      (question.type === "TEXT" ||
        (question.answerOptions.length >= 2 &&
          question.answerOptions.every((option) => option.content.trim()) &&
          question.answerOptions.some((option) => option.correct))),
    ),
  );

  return (
    <div className="grid gap-3 rounded-md border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{quizId ? "Quiz Editor" : "Create Quiz"}</p>
        {quizId ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/quizzes/${quizId}`}>Open learner view</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      </div>
      <div className="grid gap-2 md:grid-cols-[110px_130px_130px_auto] items-center">
        <Input type="number" min="0" max="100" value={passScore} onChange={(e) => setPassScore(e.target.value)} aria-label="Pass score" />
        <Input type="number" min="1" value={timeLimitMins} onChange={(e) => setTimeLimitMins(e.target.value)} placeholder="Minutes" />
        <Input type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder="Attempts" />
        <label className="flex items-center gap-2">
          <Checkbox checked={shuffleQuestions} onCheckedChange={(checked) => setShuffleQuestions(Boolean(checked))} />
          <span>Shuffle</span>
        </label>
      </div>
      <div className="grid gap-3">
        {questions.map((question, questionIndex) => (
          <div key={questionIndex} className="grid gap-2 rounded-md border bg-card p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_130px_90px_80px_auto] items-center">
              <Input
                value={question.content}
                onChange={(e) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, content: e.target.value } : item))}
                placeholder={`Question ${questionIndex + 1}`}
              />
              <Select
                value={question.type}
                onValueChange={(value) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, type: value as QuestionDraft["type"] } : item))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Single</SelectItem>
                  <SelectItem value="MULTIPLE">Multiple</SelectItem>
                  <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                  <SelectItem value="TEXT">Text</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={question.points}
                onChange={(e) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, points: e.target.value } : item))}
                aria-label="Question points"
              />
              <Input
                type="number"
                min="0"
                value={question.orderIndex}
                onChange={(e) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, orderIndex: e.target.value } : item))}
                aria-label="Question order"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={questions.length === 1}
                onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}
              >
                <MinusCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={question.explanation}
              onChange={(e) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, explanation: e.target.value } : item))}
              placeholder="Explanation shown after grading"
            />
            {question.type !== "TEXT" ? (
              <div className="grid gap-2">
                {question.answerOptions.map((option, optionIndex) => (
                  <div key={optionIndex} className="grid gap-2 md:grid-cols-[auto_1fr_80px_auto] items-center">
                    <Checkbox
                      checked={option.correct}
                      onCheckedChange={(checked) =>
                        setQuestions((current) =>
                          current.map((item, index) =>
                            index === questionIndex
                              ? {
                                  ...item,
                                  answerOptions: item.answerOptions.map((entry, idx) =>
                                    idx === optionIndex ? { ...entry, correct: Boolean(checked) } : entry,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      value={option.content}
                      onChange={(e) =>
                        setQuestions((current) =>
                          current.map((item, index) =>
                            index === questionIndex
                              ? {
                                  ...item,
                                  answerOptions: item.answerOptions.map((entry, idx) =>
                                    idx === optionIndex ? { ...entry, content: e.target.value } : entry,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <Input
                      type="number"
                      min="0"
                      value={option.orderIndex}
                      onChange={(e) =>
                        setQuestions((current) =>
                          current.map((item, index) =>
                            index === questionIndex
                              ? {
                                  ...item,
                                  answerOptions: item.answerOptions.map((entry, idx) =>
                                    idx === optionIndex ? { ...entry, orderIndex: e.target.value } : entry,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      aria-label="Option order"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={question.answerOptions.length <= 2}
                      onClick={() =>
                        setQuestions((current) =>
                          current.map((item, index) =>
                            index === questionIndex
                              ? { ...item, answerOptions: item.answerOptions.filter((_, idx) => idx !== optionIndex) }
                              : item,
                          ),
                        )
                      }
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={() =>
                    setQuestions((current) =>
                      current.map((item, index) =>
                        index === questionIndex
                          ? {
                              ...item,
                              answerOptions: [
                                ...item.answerOptions,
                                { content: "", correct: false, orderIndex: String(item.answerOptions.length) },
                              ],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <PlusCircle className="mr-1 h-3.5 w-3.5" />
                  Add option
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setQuestions((current) => [...current, blankQuestion(current.length)])}>
          <PlusCircle className="mr-1 h-3.5 w-3.5" />
          Add question
        </Button>
        <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          <Save className="mr-1 h-3.5 w-3.5" />
          {quizId ? "Save quiz" : "Create quiz"}
        </Button>
      </div>
    </div>
  );
}

function AssignmentCreatorPanel({
  lessonId,
  courseId,
  assignmentId,
}: {
  lessonId: number;
  courseId: number;
  assignmentId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [maxScore, setMaxScore] = React.useState("100");
  const [dueDays, setDueDays] = React.useState("7");

  const create = useMutation({
    mutationFn: () =>
      instructorApi.createAssignment({
        lessonId,
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        maxScore: Number(maxScore || 100),
        dueDays: Number(dueDays || 0),
      }),
    onSuccess: () => {
      toast.success("Assignment created");
      setTitle("");
      setInstructions("");
      queryClient.invalidateQueries({ queryKey: queryKeys.builderSections(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (assignmentId) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/10 p-3">
        <span className="text-xs font-semibold">Assignment linked</span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/assignments/${assignmentId}`}>Open assignment</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border bg-muted/10 p-3">
      <p className="font-semibold">Create Assignment</p>
      <div className="grid gap-2 md:grid-cols-[1fr_100px_100px]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
        <Input type="number" min="1" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} aria-label="Max score" />
        <Input type="number" min="0" value={dueDays} onChange={(e) => setDueDays(e.target.value)} aria-label="Due days" />
      </div>
      <Textarea
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="Instructions learners must follow..."
      />
      <Button size="sm" className="w-fit" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Create assignment
      </Button>
    </div>
  );
}

function ReadOnlySectionCard({ section }: { section: Section }) {
  return (
    <Card className="bg-muted/10">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Order: {section.orderIndex ?? 0}</p>
          </div>
          <StatusBadge status={section.published ? "PUBLISHED" : "DRAFT"} />
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {section.lessons?.map((lesson) => (
          <div key={lesson.id} className="flex justify-between items-center border rounded p-2.5 text-xs bg-card">
            <div>
              <p className="font-medium text-foreground">{lesson.title}</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">
                {lesson.durationSeconds ?? 0}s - {lesson.preview ? "Preview" : "Protected"}
              </p>
            </div>
            <StatusBadge status={lesson.published ? "PUBLISHED" : "DRAFT"} />
          </div>
        ))}
        {section.lessons?.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No lessons created.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* Locked version controllers */
function CourseVersionPanel({ course }: { course: Course }) {
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: queryKeys.courseVersions(course.id),
    queryFn: () => instructorApi.getVersions(course.id, { page: 0, size: 50 }),
  });

  const create = useMutation({
    mutationFn: () => instructorApi.createVersion(course.id),
    onSuccess: () => {
      toast.success("Version draft created");
      queryClient.invalidateQueries({ queryKey: queryKeys.courseVersions(course.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(course.id) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const list = versions.data?.content ?? [];
  const hasActiveDraft = list.some((v) => v.status === "DRAFT" || v.status === "REVIEWING");
  const draft = list.find((v) => v.status === "DRAFT");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Propose Changes (Versioning)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          This course is live in the catalog and direct editing is restricted. Create a version draft to propose metadata changes for the title, subtitle, description, and thumbnail. Curriculum is captured as a review snapshot.
        </p>

        <Button disabled={hasActiveDraft || create.isPending} onClick={() => create.mutate()}>
          <Plus className="mr-2 h-4 w-4" />
          Propose New Version
        </Button>

        {versions.isLoading ? <PageSkeleton rows={3} /> : null}

        {draft ? (
          <VersionDraftEditor courseId={course.id} version={draft} />
        ) : null}

        <div className="space-y-2 pt-2">
          <h4 className="font-semibold text-xs">Version Proposal History</h4>
          {list.length === 0 ? (
            <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              No version proposals have been created for this course.
            </p>
          ) : null}
          {list.map((v) => (
            <div key={v.id} className="flex items-center justify-between border rounded p-3 text-xs bg-muted/10">
              <div className="space-y-1">
                <p className="font-semibold">Version {v.versionNumber}: {v.title ?? "Untitled"}</p>
                <p className="text-[10px] text-muted-foreground">Updated: {formatDate(v.updatedAt)}</p>
                {v.rejectReason && v.status === "REJECTED" ? (
                  <p className="text-destructive font-medium mt-0.5">Rejected Reason: {v.rejectReason}</p>
                ) : null}
              </div>
              <StatusBadge status={v.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VersionDraftEditor({ courseId, version }: { courseId: number; version: CourseVersion }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(version.title ?? "");
  const [subtitle, setSubtitle] = React.useState(version.subtitle ?? "");
  const [description, setDescription] = React.useState(version.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = React.useState(version.thumbnailUrl ?? "");

  const update = useMutation({
    mutationFn: () =>
      instructorApi.updateVersion(courseId, version.id, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Version draft saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.courseVersions(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const submit = useMutation({
    mutationFn: () => instructorApi.submitVersion(courseId, version.id),
    onSuccess: () => {
      toast.success("Proposed version submitted to admin");
      queryClient.invalidateQueries({ queryKey: queryKeys.courseVersions(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.builderCourse(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCourseVersions });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex justify-between items-center border-b pb-2">
        <h4 className="font-semibold text-xs">Version {version.versionNumber} Draft Editor</h4>
        <StatusBadge status={version.status} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 text-xs">
        <div className="grid gap-1.5">
          <Label htmlFor="v-title">Title</Label>
          <Input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-subtitle">Subtitle</Label>
          <Input id="v-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5 text-xs">
        <Label htmlFor="v-desc">Description</Label>
        <Textarea id="v-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-1.5 text-xs">
        <Label htmlFor="v-thumb">Thumbnail URL</Label>
        <Input id="v-thumb" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending || !title.trim()}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save Draft
        </Button>
        <Button size="sm" variant="outline" onClick={() => submit.mutate()} disabled={submit.isPending || !title.trim()}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Submit Version
        </Button>
      </div>
    </div>
  );
}
