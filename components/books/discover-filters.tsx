import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { DiscoverParams } from "@/lib/validations/discover";
import { BOOK_CONDITIONS } from "@/types/database";

/** Plain GET form: shareable URLs, works without JS, server does the filtering. */
export function DiscoverFilters({
  params,
  genres,
  hasLocation,
}: {
  params: DiscoverParams;
  genres: string[];
  hasLocation: boolean;
}) {
  return (
    <form
      method="get"
      action="/discover"
      className="bg-card space-y-3 rounded-xl border p-4 shadow-sm"
      role="search"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Label htmlFor="q" className="sr-only">
            Search by title, author or genre
          </Label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Title, author or genre…"
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </div>
      <details
        className="group"
        open={Boolean(params.genre || params.condition || params.distance || params.status || params.sort)}
      >
        <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium">
          <SlidersHorizontal className="size-4" aria-hidden /> Filters &amp; sorting
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="grid gap-1.5">
            <Label htmlFor="genre">Genre</Label>
            <NativeSelect id="genre" name="genre" defaultValue={params.genre ?? ""}>
              <option value="">Any genre</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="condition">Condition</Label>
            <NativeSelect id="condition" name="condition" defaultValue={params.condition ?? ""}>
              <option value="">Any condition</option>
              {BOOK_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="distance">Distance</Label>
            <NativeSelect
              id="distance"
              name="distance"
              defaultValue={params.distance?.toString() ?? ""}
              disabled={!hasLocation}
            >
              <option value="">Any distance</option>
              {[2, 5, 10, 25, 50].map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="status">Availability</Label>
            <NativeSelect id="status" name="status" defaultValue={params.status ?? "Available"}>
              <option value="Available">Available now</option>
              <option value="any">Include reserved</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sort">Sort by</Label>
            <NativeSelect id="sort" name="sort" defaultValue={params.sort ?? "newest"}>
              <option value="newest">Newest</option>
              <option value="title">Title A–Z</option>
              <option value="author">Author A–Z</option>
              <option value="distance" disabled={!hasLocation}>
                Nearest
              </option>
              <option value="condition">Best condition</option>
            </NativeSelect>
          </div>
        </div>
        {!hasLocation && (
          <p className="text-muted-foreground mt-2 text-xs">
            <Link href="/profile" className="underline">
              Set your approximate location
            </Link>{" "}
            to filter and sort by distance.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button asChild type="button" size="sm" variant="ghost">
            <Link href="/discover">Reset</Link>
          </Button>
        </div>
      </details>
    </form>
  );
}
