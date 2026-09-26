import Image from "next/image";
import { BookOpen } from "lucide-react";
import { bookImageUrl, cn } from "@/lib/utils";

const OPTIMIZABLE_HOSTS = [
  /\.supabase\.co$/,
  /^books\.google\.com$/,
  /^books\.googleusercontent\.com$/,
  /^lh3\.googleusercontent\.com$/,
];

function canOptimize(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && OPTIMIZABLE_HOSTS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Shows the owner's photo of the physical copy, falling back to the Google
 * Books cover, then to a typographic placeholder "cover".
 */
export function BookCover({
  book,
  sizes = "(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw",
  priority = false,
  className,
}: {
  book: { title: string; author: string; cover_image_url: string | null; google_cover_url: string | null };
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const url = bookImageUrl(book);
  const isPhoto = Boolean(book.cover_image_url);

  return (
    <div className={cn("bg-secondary relative aspect-[3/4] w-full overflow-hidden rounded-lg", className)}>
      {url ? (
        <Image
          src={url}
          alt={isPhoto ? `Photo of ${book.title}, the owner's copy` : `Cover of ${book.title}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!canOptimize(url)}
          className={cn("object-cover", !isPhoto && "object-contain p-3")}
        />
      ) : (
        <div className="paper from-primary/85 to-primary text-primary-foreground flex h-full flex-col justify-between bg-gradient-to-br p-4">
          <BookOpen className="size-5 opacity-70" aria-hidden />
          <div>
            <p className="line-clamp-3 font-serif text-lg leading-tight font-semibold">{book.title}</p>
            <p className="mt-1 line-clamp-1 text-xs opacity-85">{book.author}</p>
          </div>
        </div>
      )}
      {url && !isPhoto && (
        <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Publisher cover
        </span>
      )}
    </div>
  );
}
