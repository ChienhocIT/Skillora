"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpen } from "lucide-react";

export function CourseThumbnail({
  src,
  title,
  sizes,
  priority = false,
  className = "object-cover",
}: {
  src?: string | null;
  title: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <div
        className="course-cover absolute inset-0 flex items-center justify-center"
        role="img"
        aria-label={`Course cover for ${title}`}
      >
        <BookOpen
          aria-hidden="true"
          className="size-12 text-primary/70"
          strokeWidth={1.5}
        />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={title}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
