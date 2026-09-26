import type { BookStatus } from "@/types/database";

/** Mirrors public.is_valid_book_transition() in the database. */
export const BOOK_TRANSITIONS: Readonly<Record<BookStatus, readonly BookStatus[]>> = {
  Available: ["Reserved", "Hidden"],
  Reserved: ["Available", "Swapped"],
  Hidden: ["Available"],
  Swapped: [],
};

export function canTransitionBook(from: BookStatus, to: BookStatus): boolean {
  return BOOK_TRANSITIONS[from].includes(to);
}

/** Transitions an owner may trigger directly (the rest belong to the swap workflow). */
export function ownerCanSetStatus(from: BookStatus, to: BookStatus, hiddenByAdmin = false): boolean {
  if (!canTransitionBook(from, to)) return false;
  if (from === "Available" && to === "Hidden") return true;
  if (from === "Hidden" && to === "Available") return !hiddenByAdmin;
  return false;
}

export function isSwappable(status: BookStatus): boolean {
  return status === "Available";
}

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  Available: "Available",
  Reserved: "Reserved",
  Swapped: "Swapped",
  Hidden: "Hidden",
};
