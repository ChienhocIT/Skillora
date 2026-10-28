"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clipboard,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi, chatApi, emptyPage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type {
  ChatAskRequest,
  ChatConversation,
  ChatMessage,
  PageResponse,
  User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const MESSAGE_PAGE = { page: 0, size: 80 };

function numberParam(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeRole(role?: string): "user" | "assistant" {
  return role?.toUpperCase() === "USER" ? "user" : "assistant";
}

function conversationLabel(conversation: ChatConversation) {
  return conversation.title?.trim() || conversation.courseTitle || `Conversation #${conversation.id}`;
}

function roleMode(user?: User) {
  if (user?.roles?.includes("ADMIN")) return "admin";
  if (user?.roles?.includes("INSTRUCTOR")) return "instructor";
  return "learner";
}

function promptSuggestions(mode: ReturnType<typeof roleMode>, courseTitle?: string | null) {
  if (mode === "admin") {
    return [
      "Review this course for approval readiness.",
      "List learner-facing risks I should check before approving.",
      "Summarize curriculum quality and missing pieces.",
    ];
  }

  if (mode === "instructor") {
    return [
      "Draft a clear lesson outline for this course.",
      "Suggest quiz questions with answer options.",
      "Improve this assignment brief for learners.",
    ];
  }

  if (courseTitle) {
    return [
      `Create a study plan for ${courseTitle}.`,
      "Explain the hardest concepts in this course.",
      "Quiz me on the next lesson in simple steps.",
    ];
  }

  return [
    "Help me choose what to learn next.",
    "Explain a concept from my course in simple terms.",
    "Create a 30-minute study plan for today.",
  ];
}

function appendMessages(
  current: PageResponse<ChatMessage> | undefined,
  messages: ChatMessage[],
) {
  const base = current ?? emptyPage<ChatMessage>();
  const existing = new Set(base.content.map((item) => item.id));
  const nextMessages = messages.filter((item) => !existing.has(item.id));
  const nextContent = [...base.content, ...nextMessages];

  return {
    ...base,
    content: nextContent,
    size: base.size || MESSAGE_PAGE.size,
    totalElements: Math.max(base.totalElements, nextContent.length),
    totalPages: Math.max(base.totalPages, 1),
    first: base.first ?? true,
    last: true,
  };
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedCourseId = numberParam(searchParams.get("courseId"));
  const requestedConversationId = numberParam(searchParams.get("conversationId"));
  const initialPrompt = searchParams.get("prompt") ?? "";

  const [activeConversation, setActiveConversation] = React.useState<number | null>(
    requestedConversationId ?? null,
  );
  const [conversationPage, setConversationPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [composerResetNonce, setComposerResetNonce] = React.useState(0);
  const [pendingMessages, setPendingMessages] = React.useState<ChatMessage[]>([]);
  const [lastRequest, setLastRequest] = React.useState<ChatAskRequest | null>(null);
  const [failedRequest, setFailedRequest] = React.useState<ChatAskRequest | null>(null);

  const composerKey = `${requestedCourseId ?? "global"}:${initialPrompt}:${composerResetNonce}`;
  const composerInitialInput = composerResetNonce > 0 ? "" : initialPrompt;

  const conversationFilters = React.useMemo(
    () => ({ page: conversationPage, size: PAGE_SIZE }),
    [conversationPage],
  );

  const messageFilters = React.useMemo(() => MESSAGE_PAGE, []);

  const { data: user } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
    retry: false,
  });

  const conversations = useQuery({
    queryKey: queryKeys.chatConversations(conversationFilters),
    queryFn: () => chatApi.conversations(conversationFilters),
  });

  const messages = useQuery({
    queryKey: activeConversation
      ? queryKeys.chatMessages(activeConversation, messageFilters)
      : ["chat-messages", "new"],
    queryFn: () => chatApi.messages(activeConversation!, messageFilters),
    enabled: Boolean(activeConversation),
  });

  const activeConversationData = conversations.data?.content.find(
    (conversation) => conversation.id === activeConversation,
  );
  const activeCourseTitle = activeConversationData?.courseTitle;
  const activeCourseId = activeConversationData?.courseId ?? requestedCourseId;
  const suggestions = promptSuggestions(roleMode(user), activeCourseTitle);

  const sendMessage = useMutation({
    mutationFn: (body: ChatAskRequest) => chatApi.ask(body),
    onMutate: (body) => {
      setLastRequest(body);
      setFailedRequest(null);
      setPendingMessages([
        {
          id: -Date.now(),
          conversationId: body.conversationId,
          role: "USER",
          content: body.message,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    onSuccess: (response) => {
      setPendingMessages([]);
      setActiveConversation(response.conversationId);
      queryClient.setQueryData<PageResponse<ChatMessage>>(
        queryKeys.chatMessages(response.conversationId, messageFilters),
        (current) => appendMessages(current, [response.userMessage, response.assistantMessage]),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.chatConversationsRoot });
    },
    onError: (error, body) => {
      setPendingMessages([]);
      setFailedRequest(body);
      toast.error((error as Error).message);
    },
  });

  async function handleSend(text: string) {
    const clean = text.trim();
    if (!clean || sendMessage.isPending) return;

    const body: ChatAskRequest = { message: clean };
    if (activeConversation) {
      body.conversationId = activeConversation;
    } else if (activeCourseId) {
      body.courseId = activeCourseId;
    }

    await sendMessage.mutateAsync(body);
  }

  function handleRetry() {
    const request = failedRequest ?? lastRequest;
    if (request && !sendMessage.isPending) {
      sendMessage.mutate(request);
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied response");
    } catch {
      toast.error("Unable to copy response");
    }
  }

  const conversationPageData = conversations.data ?? emptyPage<ChatConversation>();
  const normalizedSearch = search.trim().toLowerCase();
  const filteredConversations = conversationPageData.content.filter((conversation) => {
    if (!normalizedSearch) return true;
    return `${conversationLabel(conversation)} ${conversation.courseTitle ?? ""}`
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const messageList = [
    ...(messages.data?.content ?? []),
    ...pendingMessages,
  ];

  return (
    <AppShell>
      <PageHeader
        title="Skillora AI Assistant"
        description="Ask for course explanations, lesson help, draft ideas, or admin review notes."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setActiveConversation(null);
              setFailedRequest(null);
              setPendingMessages([]);
              setComposerResetNonce((value) => value + 1);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        }
      />

      <div className="grid gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="panel-ring flex min-h-[320px] flex-col overflow-hidden bg-card/90">
          <CardHeader className="space-y-3 border-b pb-3">
            <div>
              <CardTitle className="text-sm">Conversations</CardTitle>
              <p className="text-xs text-muted-foreground">
                Saved by backend Gemini chat history.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {conversations.isLoading ? <PageSkeleton rows={4} /> : null}
              {conversations.isError ? (
                <div className="p-2">
                  <ErrorState
                    message={(conversations.error as Error).message}
                    onRetry={() => conversations.refetch()}
                  />
                </div>
              ) : null}
              {conversations.isSuccess && filteredConversations.length === 0 ? (
                <EmptyState
                  title={search ? "No matches" : "No conversations yet"}
                  message={search ? "Try a different keyword." : "Start a new chat from the composer."}
                />
              ) : null}
              <div className="grid gap-1">
                {filteredConversations.map((conversation) => {
                  const active = activeConversation === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        setActiveConversation(conversation.id);
                        setFailedRequest(null);
                        setPendingMessages([]);
                      }}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                        active && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="block truncate font-medium">
                        {conversationLabel(conversation)}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {conversation.courseTitle ? (
                          <Badge variant="secondary" className="max-w-40 truncate px-1.5 py-0 text-[10px]">
                            {conversation.courseTitle}
                          </Badge>
                        ) : null}
                        {conversation.updatedAt ? formatRelativeTime(conversation.updatedAt) : "New"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {conversationPageData.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t p-3 text-xs">
                <span className="text-muted-foreground">
                  Page {conversationPageData.page + 1} of {conversationPageData.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={conversationPageData.first}
                    onClick={() => setConversationPage((page) => Math.max(0, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={conversationPageData.last}
                    onClick={() => setConversationPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="panel-ring flex min-h-[560px] flex-col overflow-hidden bg-card/92 lg:min-h-0">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {activeConversationData
                    ? conversationLabel(activeConversationData)
                    : "Ask Skillora AI"}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeCourseTitle
                    ? `Course context: ${activeCourseTitle}`
                    : activeCourseId
                      ? `Course context: #${activeCourseId}`
                      : "General learning and platform assistant."}
                </p>
              </div>
              {activeCourseId ? (
                <Badge variant="outline">courseId {activeCourseId}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="px-4 py-5">
                {messages.isLoading ? <PageSkeleton rows={4} /> : null}
                {messages.isError ? (
                  <ErrorState
                    message={(messages.error as Error).message}
                    onRetry={() => messages.refetch()}
                  />
                ) : null}
                {!messages.isLoading && messageList.length === 0 ? (
                  <ConversationEmptyState
                    icon={<MessageSquare className="h-10 w-10" />}
                    title="Start with a concrete question"
                    description="Ask about a course, lesson, quiz idea, assignment brief, or admin approval concern."
                  />
                ) : null}
                {messageList.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    onCopy={copyMessage}
                    onRetry={handleRetry}
                    showRetry={!sendMessage.isPending && Boolean(lastRequest)}
                  />
                ))}
                {sendMessage.isPending ? (
                  <Message from="assistant" className="max-w-[760px]">
                    <MessageContent className="rounded-lg border bg-muted/40 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Skillora AI is thinking...
                      </div>
                    </MessageContent>
                  </Message>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="border-t bg-background/55 p-4">
              {failedRequest ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <span className="text-destructive">
                    The last AI request failed. You can retry without retyping.
                  </span>
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : null}
              <PromptInputProvider key={composerKey} initialInput={composerInitialInput}>
                <ChatComposer
                  disabled={sendMessage.isPending}
                  suggestions={suggestions}
                  onSend={handleSend}
                />
              </PromptInputProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function ChatBubble({
  message,
  onCopy,
  onRetry,
  showRetry,
}: {
  message: ChatMessage;
  onCopy: (content: string) => void;
  onRetry: () => void;
  showRetry: boolean;
}) {
  const from = normalizeRole(message.role);
  const assistant = from === "assistant";

  return (
    <Message from={from} className={assistant ? "max-w-[760px]" : "max-w-[85%]"}>
      <MessageContent
        className={cn(
          assistant && "rounded-[var(--radius-card)] border bg-card px-4 py-3 shadow-sm",
        )}
      >
        {assistant ? (
          <MessageResponse>{message.content}</MessageResponse>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </MessageContent>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {message.createdAt ? <span>{formatRelativeTime(message.createdAt)}</span> : null}
        {message.model ? <span>{message.model}</span> : null}
        {message.tokensUsed ? <span>{message.tokensUsed} tokens</span> : null}
      </div>
      {assistant ? (
        <MessageActions>
          <MessageAction label="Copy response" tooltip="Copy response" onClick={() => onCopy(message.content)}>
            <Clipboard className="h-4 w-4" />
          </MessageAction>
          {showRetry ? (
            <MessageAction label="Retry last prompt" tooltip="Retry last prompt" onClick={onRetry}>
              <RefreshCcw className="h-4 w-4" />
            </MessageAction>
          ) : null}
        </MessageActions>
      ) : null}
    </Message>
  );
}

function ChatComposer({
  disabled,
  suggestions,
  onSend,
}: {
  disabled: boolean;
  suggestions: string[];
  onSend: (text: string) => Promise<void>;
}) {
  const controller = usePromptInputController();
  const canSubmit = controller.textInput.value.trim().length > 0 && !disabled;

  return (
    <div className="space-y-3">
      <Suggestions>
        {suggestions.map((suggestion) => (
          <Suggestion
            key={suggestion}
            suggestion={suggestion}
            onClick={(value) => controller.textInput.setInput(value)}
          />
        ))}
      </Suggestions>
      <PromptInput
        onSubmit={({ text }) => onSend(text)}
        className="rounded-[var(--radius-card)] border bg-background shadow-sm"
      >
        <PromptInputTextarea
          disabled={disabled}
          placeholder="Ask Skillora AI about a lesson, course, quiz, assignment, or review..."
        />
        <PromptInputFooter>
          <span className="text-xs text-muted-foreground">
            AI can make mistakes. Check important details before applying them.
          </span>
          <PromptInputSubmit
            disabled={!canSubmit}
            status={disabled ? "submitted" : undefined}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
