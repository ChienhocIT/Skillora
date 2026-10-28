import type { ApiResponse, PageResponse } from "@/lib/types";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export class ApiError extends Error {
  status: number;
  errors?: string[] | null;

  constructor(message: string, status: number, errors?: string[] | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function toQueryString(query?: ApiOptions["query"]) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = `/api/backend${path.startsWith("/") ? path : `/${path}`}${toQueryString(
    options.query,
  )}`;
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.errors,
    );
  }

  return payload?.data as T;
}

export function emptyPage<T>(): PageResponse<T> {
  return {
    content: [],
    page: 0,
    size: 0,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Typed domain API helpers                                          */
/* ------------------------------------------------------------------ */

import type {
  AuthResponse,
  User,
  Profile,
  Category,
  Course,
  CourseSummary,
  CourseVersion,
  Section,
  Lesson,
  LessonProgress,
  LessonResource,
  LessonVideoUploadUrlRequest,
  LessonVideoUploadUrlResponse,
  Enrollment,
  LearningDashboard,
  Cart,
  Order,
  PaymentCreateResponse,
  Quiz,
  QuizAttempt,
  QuizAnswerInput,
  Assignment,
  AssignmentSubmission,
  NotificationItem,
  Review,
  AdminStats,
  AdminCourse,
  AdminCourseDetail,
  AdminUser,
  Coupon,
  AuditLog,
  WishlistItem,
  ChatConversation,
  ChatAskRequest,
  ChatMessage,
  ChatResponse,
  InstructorProfile,
} from "@/lib/types";

/* --- Auth --------------------------------------------------------- */
export const authApi = {
  me: () => apiFetch<User>("/auth/me"),
  login: (body: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/auth/login", { method: "POST", body }),
  register: (body: Record<string, unknown>) =>
    apiFetch<AuthResponse>("/auth/register", { method: "POST", body }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    apiFetch<{ resetToken?: string | null }>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (body: { token: string; password: string }) =>
    apiFetch<void>("/auth/reset-password", { method: "POST", body }),
};

/* --- Profile ------------------------------------------------------ */
export const profileApi = {
  me: () => apiFetch<Profile>("/profiles/me"),
  updateMe: (body: Partial<Profile>) =>
    apiFetch<Profile>("/profiles/me", { method: "PUT", body }),
};

/* --- Instructors (public) ---------------------------------------- */
export const publicInstructorApi = {
  get: (id: number) => apiFetch<InstructorProfile>(`/instructors/${id}`),
};

/* --- Courses (public) -------------------------------------------- */
export const courseApi = {
  list: (query: Record<string, unknown>) =>
    apiFetch<PageResponse<CourseSummary>>("/courses", { query: query as ApiOptions["query"] }),
  getById: (idOrSlug: string | number) => apiFetch<Course>(`/courses/${idOrSlug}`),
  getSections: (courseId: number) => apiFetch<Section[]>(`/courses/${courseId}/sections`),
  getReviews: (query: Record<string, unknown>) =>
    apiFetch<PageResponse<Review>>("/reviews", { query: query as ApiOptions["query"] }),
  categories: () => apiFetch<Category[]>("/categories"),
};

/* --- Learner ----------------------------------------------------- */
export const learnerApi = {
  dashboard: () => apiFetch<LearningDashboard>("/learning/dashboard"),
  enrollments: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<Enrollment>>("/enrollments/me", { query: query as ApiOptions["query"] }),
  enrollmentProgress: (enrollmentId: number) =>
    apiFetch<LessonProgress[]>(`/enrollments/${enrollmentId}/progress`),
  markLessonProgress: (enrollmentId: number, lessonId: number, body: Record<string, unknown>) =>
    apiFetch(`/enrollments/${enrollmentId}/lessons/${lessonId}/progress`, { method: "PATCH", body }),
  certificate: (enrollmentId: number) =>
    apiFetch<{ url?: string }>(`/enrollments/${enrollmentId}/certificate`),
  getLesson: (lessonId: number) => apiFetch<Lesson>(`/lessons/${lessonId}`),
  enroll: (courseId: number) => apiFetch("/courses/" + courseId + "/enroll", { method: "POST" }),
};

/* --- Commerce ---------------------------------------------------- */
type CommerceCourseResponse = Omit<WishlistItem, "courseId" | "addedAt"> & { id: number };
type CommerceItemsResponse = {
  items: Array<{ course: CommerceCourseResponse; addedAt?: string }>;
  subtotalAmount: number | string;
  currency: string;
};

export const commerceApi = {
  getCart: async (): Promise<Cart> => {
    const cart = await apiFetch<CommerceItemsResponse>("/cart");
    return {
      items: cart.items.map(({ course }) => ({ ...course, courseId: course.id })),
      subtotal: cart.subtotalAmount,
      total: cart.subtotalAmount,
      currency: cart.currency,
    };
  },
  addToCart: (courseId: number) => apiFetch("/cart/" + courseId, { method: "POST" }),
  removeFromCart: (courseId: number) => apiFetch<void>(`/cart/${courseId}`, { method: "DELETE" }),
  checkout: (body?: { couponCode?: string }) =>
    apiFetch<Order>("/orders/checkout", { method: "POST", body }),
  getOrders: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<Order>>("/orders/me", { query: query as ApiOptions["query"] }),
  getOrder: (orderId: number) => apiFetch<Order>(`/orders/${orderId}`),
  cancelOrder: (orderId: number) => apiFetch(`/orders/${orderId}/cancel`, { method: "PATCH" }),
  createPayment: (gateway: "vnpay" | "momo", orderId: number) =>
    apiFetch<PaymentCreateResponse>(`/payments/${gateway}/create`, { method: "POST", body: { orderId } }),
  validateCoupon: (code: string) =>
    apiFetch<{ discountType: string; discountValue: number | string }>(
      "/coupons/validate",
      { method: "POST", body: { code } },
    ),
  getWishlist: async (): Promise<WishlistItem[]> => {
    const wishlist = await apiFetch<Pick<CommerceItemsResponse, "items">>("/wishlist");
    return wishlist.items.map(({ course, addedAt }) => ({ ...course, courseId: course.id, addedAt }));
  },
  addToWishlist: (courseId: number) => apiFetch("/wishlist/" + courseId, { method: "POST" }),
  removeFromWishlist: (courseId: number) => apiFetch<void>(`/wishlist/${courseId}`, { method: "DELETE" }),
};

/* --- Quiz / Assignment ------------------------------------------- */
export const practiceApi = {
  getQuiz: (quizId: number) => apiFetch<Quiz>(`/quizzes/${quizId}`),
  startQuiz: (quizId: number) => apiFetch<QuizAttempt>(`/quizzes/${quizId}/attempts/start`, { method: "POST" }),
  submitQuiz: (quizId: number, attemptId: number, answers: QuizAnswerInput[]) =>
    apiFetch<QuizAttempt>(`/quizzes/${quizId}/submit`, { method: "POST", body: { attemptId, answers } }),
  getAttempts: (quizId: number) => apiFetch<QuizAttempt[]>(`/quizzes/${quizId}/attempts`),
  getAssignment: (assignmentId: number) => apiFetch<Assignment>(`/assignments/${assignmentId}`),
  submitAssignment: (assignmentId: number, body: { content?: string; fileUrl?: string }) =>
    apiFetch<AssignmentSubmission>(`/assignments/${assignmentId}/submit`, { method: "POST", body }),
};

/* --- Reviews ----------------------------------------------------- */
export const reviewApi = {
  create: (body: { courseId: number; rating: number; content?: string }) =>
    apiFetch<Review>("/reviews", { method: "POST", body }),
  update: (reviewId: number, body: { rating: number; content?: string }) =>
    apiFetch<Review>(`/reviews/${reviewId}`, { method: "PUT", body }),
  remove: (reviewId: number) => apiFetch<void>(`/reviews/${reviewId}`, { method: "DELETE" }),
  like: (reviewId: number) => apiFetch(`/reviews/${reviewId}/like`, { method: "POST" }),
  unlike: (reviewId: number) => apiFetch<void>(`/reviews/${reviewId}/like`, { method: "DELETE" }),
};

/* --- Notifications ----------------------------------------------- */
export const notificationApi = {
  list: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<NotificationItem>>("/notifications", { query: query as ApiOptions["query"] }),
  markRead: (id: number) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch("/notifications/read-all", { method: "PATCH" }),
  streamUrl: () => "/api/backend/notifications/stream",
};

/* --- Chat -------------------------------------------------------- */
export const chatApi = {
  conversations: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<ChatConversation>>("/chat/conversations", {
      query: query as ApiOptions["query"],
    }),
  messages: (conversationId: number, query?: Record<string, unknown>) =>
    apiFetch<PageResponse<ChatMessage>>(`/chat/conversations/${conversationId}/messages`, {
      query: query as ApiOptions["query"],
    }),
  ask: (body: ChatAskRequest) =>
    apiFetch<ChatResponse>("/chat/ask", { method: "POST", body }),
};

/* --- Instructor -------------------------------------------------- */
export const instructorApi = {
  myCourses: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<CourseSummary>>("/courses/me", { query: query as ApiOptions["query"] }),
  createCourse: (body: Record<string, unknown>) =>
    apiFetch<Course>("/courses", { method: "POST", body }),
  updateCourse: (courseId: number, body: Record<string, unknown>) =>
    apiFetch<Course>(`/courses/${courseId}`, { method: "PUT", body }),
  deleteCourse: (courseId: number) => apiFetch<void>(`/courses/${courseId}`, { method: "DELETE" }),
  submitReview: (courseId: number) =>
    apiFetch<Course>(`/courses/${courseId}/publish`, { method: "PATCH" }),
  archiveCourse: (courseId: number) =>
    apiFetch<Course>(`/courses/${courseId}/archive`, { method: "PATCH" }),
  /* Sections */
  createSection: (courseId: number, body: Record<string, unknown>) =>
    apiFetch(`/courses/${courseId}/sections`, { method: "POST", body }),
  updateSection: (sectionId: number, body: Record<string, unknown>) =>
    apiFetch(`/sections/${sectionId}`, { method: "PUT", body }),
  deleteSection: (sectionId: number) =>
    apiFetch(`/sections/${sectionId}`, { method: "DELETE" }),
  /* Lessons */
  createLesson: (sectionId: number, body: Record<string, unknown>) =>
    apiFetch(`/sections/${sectionId}/lessons`, { method: "POST", body }),
  updateLesson: (lessonId: number, body: Record<string, unknown>) =>
    apiFetch(`/lessons/${lessonId}`, { method: "PUT", body }),
  deleteLesson: (lessonId: number) =>
    apiFetch(`/lessons/${lessonId}`, { method: "DELETE" }),
  /* Resources */
  createResource: (lessonId: number, body: Record<string, unknown>) =>
    apiFetch<LessonResource>(`/lessons/${lessonId}/resources`, { method: "POST", body }),
  updateResource: (resourceId: number, body: Record<string, unknown>) =>
    apiFetch<LessonResource>(`/lesson-resources/${resourceId}`, { method: "PUT", body }),
  deleteResource: (resourceId: number) =>
    apiFetch<void>(`/lesson-resources/${resourceId}`, { method: "DELETE" }),
  /* Video */
  getUploadUrl: (lessonId: number, body: LessonVideoUploadUrlRequest) =>
    apiFetch<LessonVideoUploadUrlResponse>(`/lessons/${lessonId}/video/upload-url`, {
      method: "POST",
      body,
    }),
  /* Versions */
  getVersions: (courseId: number, query?: Record<string, unknown>) =>
    apiFetch<PageResponse<CourseVersion>>(`/courses/${courseId}/versions`, { query: query as ApiOptions["query"] }),
  getVersion: (courseId: number, versionId: number) =>
    apiFetch<CourseVersion>(`/courses/${courseId}/versions/${versionId}`),
  createVersion: (courseId: number) =>
    apiFetch<CourseVersion>(`/courses/${courseId}/versions`, { method: "POST" }),
  updateVersion: (courseId: number, versionId: number, body: Record<string, unknown>) =>
    apiFetch<CourseVersion>(`/courses/${courseId}/versions/${versionId}`, { method: "PUT", body }),
  submitVersion: (courseId: number, versionId: number) =>
    apiFetch<CourseVersion>(`/courses/${courseId}/versions/${versionId}/submit`, { method: "PATCH" }),
  /* Quiz */
  createQuiz: (body: Record<string, unknown>) =>
    apiFetch<Quiz>("/quizzes", { method: "POST", body }),
  updateQuiz: (quizId: number, body: Record<string, unknown>) =>
    apiFetch<Quiz>(`/quizzes/${quizId}`, { method: "PUT", body }),
  /* Assignment */
  createAssignment: (body: Record<string, unknown>) =>
    apiFetch<Assignment>("/assignments", { method: "POST", body }),
  /* Grading */
  getSubmissions: (assignmentId: number, query?: Record<string, unknown>) =>
    apiFetch<PageResponse<AssignmentSubmission>>(`/assignments/${assignmentId}/submissions`, {
      query: query as ApiOptions["query"],
    }),
  gradeSubmission: (submissionId: number, body:
    { status: "GRADED"; score: number; passed: boolean; feedback: string }
    | { status: "RETURNED"; feedback: string }) =>
    apiFetch(`/submissions/${submissionId}/grade`, { method: "PATCH", body }),
};

/* --- Admin ------------------------------------------------------- */
export const adminApi = {
  dashboard: () => apiFetch<AdminStats>("/admin/dashboard"),
  revenue: () =>
    apiFetch<{
      totalRevenue?: number | string;
      totalPaidOrders?: number;
      totalPendingOrders?: number;
      avgOrderValue?: number | string;
    }>("/admin/revenue"),
  /* Users */
  users: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<AdminUser>>("/admin/users", { query: query as ApiOptions["query"] }),
  getUser: (userId: number) => apiFetch<AdminUser>(`/admin/users/${userId}`),
  updateUserStatus: (userId: number, status: string) =>
    apiFetch(`/admin/users/${userId}/status`, { method: "PATCH", body: { status } }),
  /* Courses */
  courses: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<AdminCourse>>("/admin/courses", { query: query as ApiOptions["query"] }),
  courseDetail: (courseId: number) => apiFetch<AdminCourseDetail>(`/admin/courses/${courseId}`),
  approveCourse: (courseId: number) =>
    apiFetch(`/admin/courses/${courseId}/approve`, { method: "PATCH" }),
  rejectCourse: (courseId: number, reason: string) =>
    apiFetch(`/admin/courses/${courseId}/reject`, { method: "PATCH", body: { reason } }),
  /* Versions */
  courseVersions: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<CourseVersion>>("/admin/course-versions", { query: query as ApiOptions["query"] }),
  approveVersion: (courseId: number, versionId: number) =>
    apiFetch(`/admin/courses/${courseId}/versions/${versionId}/approve`, { method: "PATCH" }),
  rejectVersion: (courseId: number, versionId: number, reason: string) =>
    apiFetch(`/admin/courses/${courseId}/versions/${versionId}/reject`, {
      method: "PATCH",
      body: { reason },
    }),
  /* Coupons */
  coupons: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<Coupon>>("/admin/coupons", { query: query as ApiOptions["query"] }),
  createCoupon: (body: Record<string, unknown>) =>
    apiFetch<Coupon>("/admin/coupons", { method: "POST", body }),
  updateCoupon: (couponId: number, body: Record<string, unknown>) =>
    apiFetch<Coupon>(`/admin/coupons/${couponId}`, { method: "PUT", body }),
  deactivateCoupon: (couponId: number) =>
    apiFetch(`/admin/coupons/${couponId}`, { method: "DELETE" }),
  /* Categories */
  createCategory: (body: { name: string; description?: string }) =>
    apiFetch<Category>("/categories", { method: "POST", body }),
  updateCategory: (categoryId: number, body: { name: string; description?: string }) =>
    apiFetch<Category>(`/categories/${categoryId}`, { method: "PUT", body }),
  deleteCategory: (categoryId: number) =>
    apiFetch<void>(`/categories/${categoryId}`, { method: "DELETE" }),
  /* Audit Logs */
  auditLogs: (query?: Record<string, unknown>) =>
    apiFetch<PageResponse<AuditLog>>("/admin/audit-logs", { query: query as ApiOptions["query"] }),
};
