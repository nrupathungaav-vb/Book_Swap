import { describe, expect, it } from "vitest";
import { canTransitionBook, isSwappable, ownerCanSetStatus } from "@/lib/books/status";
import { availableSwapActions, canTransitionSwap, isActiveSwap, swapRole } from "@/lib/swaps/status";
import { BOOK_STATUSES, SWAP_STATUSES } from "@/types/database";

describe("book status transitions", () => {
  const allowed = new Set([
    "Available>Reserved",
    "Reserved>Available",
    "Reserved>Swapped",
    "Available>Hidden",
    "Hidden>Available",
  ]);

  it.each(BOOK_STATUSES.flatMap((from) => BOOK_STATUSES.map((to) => [from, to] as const)))(
    "%s → %s",
    (from, to) => {
      expect(canTransitionBook(from, to)).toBe(allowed.has(`${from}>${to}`));
    },
  );

  it("owners can only hide/unhide; reservations belong to the swap workflow", () => {
    expect(ownerCanSetStatus("Available", "Hidden")).toBe(true);
    expect(ownerCanSetStatus("Hidden", "Available")).toBe(true);
    expect(ownerCanSetStatus("Hidden", "Available", true)).toBe(false);
    expect(ownerCanSetStatus("Available", "Reserved")).toBe(false);
    expect(ownerCanSetStatus("Reserved", "Swapped")).toBe(false);
  });

  it("only Available books are swappable", () => {
    expect(BOOK_STATUSES.filter(isSwappable)).toEqual(["Available"]);
  });
});

describe("swap status transitions", () => {
  const allowed = new Set([
    "Pending>Accepted",
    "Pending>Rejected",
    "Pending>Cancelled",
    "Accepted>Completed",
    "Accepted>Cancelled",
  ]);

  it.each(SWAP_STATUSES.flatMap((from) => SWAP_STATUSES.map((to) => [from, to] as const)))(
    "%s → %s",
    (from, to) => {
      expect(canTransitionSwap(from, to)).toBe(allowed.has(`${from}>${to}`));
    },
  );

  it("active = pending or accepted", () => {
    expect(SWAP_STATUSES.filter(isActiveSwap)).toEqual(["Pending", "Accepted"]);
  });
});

describe("availableSwapActions", () => {
  const swap = {
    requester_id: "req",
    responder_id: "res",
    requester_completed: false,
    responder_completed: false,
  };

  it("responder can accept/reject a pending request; requester can withdraw", () => {
    const responder = availableSwapActions({ ...swap, status: "Pending" }, "res");
    expect(responder).toMatchObject({ canAccept: true, canReject: true, canCancel: false, canChat: true });
    const requester = availableSwapActions({ ...swap, status: "Pending" }, "req");
    expect(requester).toMatchObject({ canAccept: false, canReject: false, canCancel: true });
  });

  it("either participant can complete/cancel an accepted swap and arrange a meeting", () => {
    for (const user of ["req", "res"]) {
      expect(availableSwapActions({ ...swap, status: "Accepted" }, user)).toMatchObject({
        canComplete: true,
        canCancel: true,
        canArrangeMeeting: true,
      });
    }
  });

  it("waits for the other side after confirming", () => {
    const actions = availableSwapActions({ ...swap, status: "Accepted", requester_completed: true }, "req");
    expect(actions.canComplete).toBe(false);
    expect(actions.waitingForOther).toBe(true);
  });

  it("outsiders get nothing and closed swaps are read-only", () => {
    expect(
      Object.values(availableSwapActions({ ...swap, status: "Accepted" }, "stranger")).some(Boolean),
    ).toBe(false);
    const done = availableSwapActions({ ...swap, status: "Completed" }, "req");
    expect(done.canChat).toBe(false);
    expect(done.canCancel).toBe(false);
    expect(swapRole(swap, "stranger")).toBeNull();
  });
});
