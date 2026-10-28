export type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data?: T;
  errors?: string[] | null;
  timestamp?: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type User = {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "BANNED" | "DELETED" | string;
  emailVerified?: boolean;
  roles: UserRole[];
  lastLoginAt?: string | null;
  createdAt?: string;
};

export type Profile = {
  id: number;
  userId: number;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
};

export type Category = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
};

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";
export type CourseStatus = "DRAFT" | "REVIEWING" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type CourseVersionStatus = "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED";
export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | string;

export type CourseSummary = {
  id: number;
  title: string;
  slug?: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  level?: CourseLevel;
  price?: number | string;
  discountPrice?: number | string | null;
  currency?: string;
  status?: CourseStatus;
  instructorId?: number;
  instructorName?: string;
  totalLessons?: number;
  totalDurationSeconds?: number;
  totalEnrollments?: number;
  avgRating?: number | string | null;
  totalReviews?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Course = CourseSummary & {
  description?: string | null;
  previewVideoUrl?: string | null;
  language?: string | null;
  rejectReason?: string | null;
  categories?: Category[];
  requirements?: string[];
  outcomes?: string[];
  publishedAt?: string | null;
  deletedAt?: string | null;
};

export type Section = {
  id: number;
  courseId?: number;
  title: string;
  description?: string | null;
  orderIndex?: number;
  position?: number;
  published?: boolean;
  lessons?: LessonSummary[];
};

export type LessonSummary = {
  id: number;
  sectionId?: number;
  quizId?: number | null;
  assignmentId?: number | null;
  title: string;
  slug?: string;
  type?: string;
  durationSeconds?: number;
  orderIndex?: number;
  position?: number;
  preview?: boolean;
  published?: boolean;
  hasVideo?: boolean;
  videoStatus?: VideoStatus | null;
};

export type Lesson = LessonSummary & {
  sectionId?: number;
  courseId?: number;
  slug?: string;
  content?: string | null;
  video?: LessonVideo | null;
  videoUrl?: string | null;
  resources?: LessonResource[];
  quizId?: number | null;
  assignmentId?: number | null;
};

export type LessonVideo = {
  id?: number;
  provider?: string;
  assetId?: string | null;
  playbackUrl?: string | null;
  embedUrl?: string | null;
  hlsUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number;
  sizeBytes?: number | null;
  mimeType?: string | null;
  status?: VideoStatus | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LessonResource = {
  id: number;
  lessonId?: number;
  name: string;
  fileUrl: string;
  resourceType?: string;
  sizeBytes?: number | null;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Enrollment = {
  id: number;
  userId?: number;
  courseId: number;
  courseTitle?: string;
  courseSlug?: string;
  courseThumbnailUrl?: string | null;
  courseLevel?: string;
  instructorName?: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | string;
  amountPaid?: number | string;
  progressPercent?: number;
  enrolledAt?: string;
  completedAt?: string | null;
  expiresAt?: string | null;
};

export type LessonProgress = {
  id?: number;
  enrollmentId?: number;
  lessonId: number;
  lessonTitle: string;
  watchedSeconds?: number;
  totalDurationSeconds: number;
  completed: boolean;
  completedAt?: string | null;
  lastAccessedAt?: string | null;
};

export type LearningDashboard = {
  totalEnrolled?: number;
  inProgress?: number;
  completed?: number;
  certificatesEarned?: number;
  recentEnrollments?: Enrollment[];
  [key: string]: unknown;
};

export type LessonVideoUploadUrlRequest = {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type LessonVideoUploadUrlResponse = {
  lessonVideoId: number;
  videoId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  expiresAt?: string;
};

export type CartItem = {
  courseId: number;
  title: string;
  thumbnailUrl?: string | null;
  price?: number | string;
  discountPrice?: number | string | null;
  currency?: string;
};

export type Cart = {
  items: CartItem[];
  subtotal?: number | string;
  total?: number | string;
  currency?: string;
};

export type Order = {
  id: number;
  status: "PENDING" | "PAID" | "CANCELLED" | "FAILED" | string;
  totalAmount?: number | string;
  currency?: string;
  failureReason?: string | null;
  createdAt?: string;
  items?: { courseId: number; title?: string; courseTitleSnapshot?: string; price?: number | string; finalPrice?: number | string }[];
};

export type PaymentCreateResponse = {
  orderId: number;
  paymentTransactionId: number;
  gateway: "VNPAY" | "MOMO";
  amount: number | string;
  currency: string;
  payUrl: string;
};

export type Quiz = {
  id: number;
  lessonId?: number;
  courseId?: number;
  title: string;
  description?: string | null;
  passScore?: number;
  passingScore?: number;
  timeLimitMins?: number | null;
  maxAttempts?: number | null;
  questionCount?: number;
  questions?: Question[];
  createdAt?: string;
  updatedAt?: string;
};

export type Question = {
  id: number;
  content?: string;
  text: string;
  type?: string;
  points?: number;
  orderIndex?: number;
  explanation?: string | null;
  answerOptions?: AnswerOption[];
  options?: AnswerOption[];
};

export type AnswerOption = {
  id: number;
  content?: string;
  text: string;
  correct?: boolean;
  orderIndex?: number;
  explanation?: string | null;
};

export type QuizAttempt = {
  id: number;
  quizId: number;
  enrollmentId?: number;
  userId?: number;
  attemptNo?: number;
  score?: number;
  passed?: boolean;
  startedAt?: string;
  submittedAt?: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  deadlineAt?: string | null;
  serverTime: string;
  answers?: QuizAttemptAnswer[];
};

export type QuizAnswerInput = {
  questionId: number;
  selectedOptionIds?: number[];
  textAnswer?: string;
};

export type QuizAttemptAnswer = {
  questionId: number;
  correct?: boolean | null;
  pointsEarned?: number | string | null;
  selectedOptionIds?: number[];
  textAnswer?: string | null;
};

export type Assignment = {
  id: number;
  lessonId?: number;
  courseId?: number;
  lessonTitle?: string;
  title: string;
  instructions?: string | null;
  description?: string | null;
  dueDays?: number | null;
  dueAt?: string | null;
  overdue?: boolean;
  maxScore?: number;
  mySubmission?: AssignmentSubmission | null;
};

export type AssignmentSubmission = {
  id: number;
  assignmentId: number;
  enrollmentId?: number;
  userId?: number;
  studentName?: string;
  status: "SUBMITTED" | "GRADED" | "RETURNED" | string;
  content?: string | null;
  fileUrl?: string | null;
  score?: number | null;
  passed?: boolean | null;
  feedback?: string | null;
  submittedAt?: string;
  gradedAt?: string | null;
  gradedById?: number | null;
  gradedByName?: string | null;
  dueAt?: string | null;
  late?: boolean;
};

export type NotificationItem = {
  id: number;
  title?: string;
  content?: string;
  message?: string;
  type?: string | null;
  linkUrl?: string | null;
  entityType?: string | null;
  entityId?: number | string | null;
  read?: boolean;
  createdAt?: string;
};

export type Review = {
  id: number;
  courseId: number;
  userId?: number;
  userName?: string;
  userAvatarUrl?: string | null;
  rating: number;
  content?: string | null;
  status?: string;
  likeCount?: number;
  likedByMe?: boolean;
  createdAt?: string;
};

export type AdminStats = {
  users?: { total?: number; active?: number; banned?: number; newThisMonth?: number };
  courses?: { total?: number; published?: number; draft?: number; reviewing?: number; archived?: number };
  enrollments?: { total?: number; active?: number; completed?: number };
  revenue?: { totalOrders?: number; paidOrders?: number; totalRevenue?: number | string };
  reviews?: { totalPublished?: number; avgPlatformRating?: number | string };
  totalUsers?: number;
  totalCourses?: number;
  publishedCourses?: number;
  pendingCourses?: number;
  totalRevenue?: number | string;
  [key: string]: unknown;
};

export type AdminCourse = Course & {
  instructorEmail?: string;
};

export type AdminCourseDetail = {
  course: Course;
  sections: Section[];
};

export type CourseVersion = {
  id: number;
  courseId: number;
  versionNumber: number;
  status: CourseVersionStatus;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  rejectReason?: string | null;
  snapshotJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUser = User & {
  roleNames?: UserRole[];
};

export type Coupon = {
  id: number;
  code: string;
  name?: string | null;
  discountType?: "PERCENT" | "FIXED" | string;
  discountValue?: number | string;
  type?: string;
  value?: number | string;
  maxUses?: number | null;
  usedCount?: number;
  minOrderAmount?: number | string | null;
  startsAt?: string | null;
  active?: boolean;
  expiresAt?: string | null;
};

export type AuditLog = {
  id: number;
  actorId?: number;
  actorEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string | number;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string;
  createdAt?: string;
};

export type WishlistItem = {
  courseId: number;
  title: string;
  slug?: string;
  thumbnailUrl?: string | null;
  instructorName?: string;
  price?: number | string;
  discountPrice?: number | string | null;
  currency?: string;
  avgRating?: number | string | null;
  totalReviews?: number;
  level?: CourseLevel;
  addedAt?: string;
};

export type ChatConversation = {
  id: number;
  courseId?: number | null;
  courseTitle?: string | null;
  title?: string | null;
  lastMessage?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export type ChatMessage = {
  id: number;
  conversationId?: number;
  role?: "USER" | "ASSISTANT" | "SYSTEM" | "user" | "assistant" | "system" | string;
  content: string;
  model?: string | null;
  tokensUsed?: number | null;
  createdAt?: string;
};

export type ChatAskRequest = {
  message: string;
  conversationId?: number;
  courseId?: number;
};

export type ChatResponse = {
  conversationId: number;
  conversationTitle?: string | null;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

export type UserProfile = {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  instructorTitle?: string | null;
  instructorExpertise?: string | null;
  createdAt?: string;
};

export type InstructorProfile = {
  id: number;
  userId: number;
  fullName?: string | null;
  avatarUrl?: string | null;
  title?: string | null;
  expertise?: string | null;
  introVideoUrl?: string | null;
  verified?: boolean;
  headline?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
