/**
 * End-to-end data-layer tests through supabase-js against a real Supabase stack
 * (Auth + PostgREST + Storage + RLS). Skipped unless SUPABASE_TEST_URL and
 * SUPABASE_TEST_ANON_KEY are set — see tests/integration/README.md.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const enabled = Boolean(url && anonKey);

type Client = SupabaseClient<Database>;

async function newUser(label: string): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@bookswap.test`;
  const { data, error } = await client.auth.signUp({
    email,
    password: "BookSwap#2026",
    options: { data: { full_name: `${label} Tester` } },
  });
  if (error || !data.user) throw error ?? new Error("sign-up failed");
  if (!data.session) {
    const signIn = await client.auth.signInWithPassword({ email, password: "BookSwap#2026" });
    if (signIn.error) throw new Error("Email confirmation must be disabled for integration tests");
  }
  return { client, id: data.user.id };
}

async function addBook(client: Client, userId: string, title: string, author: string) {
  const { data, error } = await client
    .from("books")
    .insert({ user_id: userId, title, author, condition: "Good" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  return data.id;
}

describe.skipIf(!enabled)("Supabase integration (real stack)", () => {
  let alice: { client: Client; id: string };
  let bob: { client: Client; id: string };
  let mallory: { client: Client; id: string };
  let aliceBook: string;
  let bobBook: string;
  const tag = crypto.randomUUID().slice(0, 6);
  const titleA = `Integration Classic ${tag}`;
  const titleB = `Integration Fantasy ${tag}`;

  beforeAll(async () => {
    [alice, bob, mallory] = await Promise.all([newUser("alice"), newUser("bob"), newUser("mallory")]);
  });

  it("auth: a profile row is created for each new user", async () => {
    const { data } = await alice.client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", alice.id)
      .single();
    expect(data).toMatchObject({ id: alice.id, full_name: "alice Tester", role: "user" });
  });

  it("books: owners can create; others cannot write", async () => {
    aliceBook = await addBook(alice.client, alice.id, titleA, "Author A");
    bobBook = await addBook(bob.client, bob.id, titleB, "Author B");
    const { error } = await mallory.client
      .from("books")
      .insert({ user_id: alice.id, title: "Fake", author: "X", condition: "Good" });
    expect(error).not.toBeNull();
    const { data } = await mallory.client
      .from("books")
      .update({ title: "pwned" })
      .eq("id", aliceBook)
      .select();
    expect(data).toEqual([]);
  });

  it("wishlist + matching: mutual interest produces a match for both users", async () => {
    await alice.client.from("wishlists").insert({ user_id: alice.id, title: titleB });
    await bob.client.from("wishlists").insert({ user_id: bob.id, title: titleA });
    const { data: aliceMatches } = await alice.client.rpc("get_my_matches");
    expect(aliceMatches?.some((m) => m.their_book_id === bobBook && m.my_book_id === aliceBook)).toBe(true);
    const { data: malloryMatches } = await mallory.client.rpc("get_my_matches");
    expect(malloryMatches).toEqual([]);
    const { data: bobNotes } = await bob.client
      .from("notifications")
      .select("type")
      .eq("type", "mutual_match");
    expect(bobNotes?.length).toBeGreaterThan(0);
  });

  it("image upload permissions: only into your own book folder", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const own = await alice.client.storage
      .from("book-covers")
      .upload(`${alice.id}/${aliceBook}/test.png`, png, { contentType: "image/png" });
    expect(own.error).toBeNull();
    const foreign = await mallory.client.storage
      .from("book-covers")
      .upload(`${alice.id}/${aliceBook}/evil.png`, png, { contentType: "image/png" });
    expect(foreign.error).not.toBeNull();
    const del = await mallory.client.storage
      .from("book-covers")
      .remove([`${alice.id}/${aliceBook}/test.png`]);
    expect(del.data ?? []).toEqual([]);
  });

  let swapId: string;

  it("swap requests: validation, accept reserves both books atomically", async () => {
    const own = await alice.client.rpc("create_swap_request", {
      p_requested_book_id: aliceBook,
      p_offered_book_id: aliceBook,
    });
    expect(own.error).not.toBeNull();
    const created = await alice.client.rpc("create_swap_request", {
      p_requested_book_id: bobBook,
      p_offered_book_id: aliceBook,
    });
    expect(created.error).toBeNull();
    swapId = created.data!;
    const dup = await alice.client.rpc("create_swap_request", {
      p_requested_book_id: bobBook,
      p_offered_book_id: aliceBook,
    });
    expect(dup.error?.message).toMatch(/already an active/);
    const wrongAccept = await alice.client.rpc("accept_swap_request", { p_swap_id: swapId });
    expect(wrongAccept.error).not.toBeNull();
    const accepted = await bob.client.rpc("accept_swap_request", { p_swap_id: swapId });
    expect(accepted.data?.status).toBe("Accepted");
    const { data: books } = await alice.client.from("books").select("status").in("id", [aliceBook, bobBook]);
    expect(books?.map((b) => b.status)).toEqual(["Reserved", "Reserved"]);
  });

  it("chat authorisation: only participants read/write messages", async () => {
    const sent = await alice.client
      .from("messages")
      .insert({ swap_request_id: swapId, sender_id: alice.id, text: "hello" });
    expect(sent.error).toBeNull();
    const spoof = await mallory.client
      .from("messages")
      .insert({ swap_request_id: swapId, sender_id: mallory.id, text: "hi" });
    expect(spoof.error).not.toBeNull();
    const { data: peek } = await mallory.client.from("messages").select("*").eq("swap_request_id", swapId);
    expect(peek).toEqual([]);
    const { data: bobReads } = await bob.client.from("messages").select("text").eq("swap_request_id", swapId);
    expect(bobReads?.map((m) => m.text)).toEqual(["hello"]);
  });

  it("meeting authorisation: participants only, the other side responds", async () => {
    const { data: meeting, error } = await bob.client
      .from("meeting_locations")
      .insert({
        swap_request_id: swapId,
        suggested_by_user_id: bob.id,
        lat: 12.97,
        lng: 77.59,
        location_name: "Central Library",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    const outsider = await mallory.client.from("meeting_locations").select("*").eq("swap_request_id", swapId);
    expect(outsider.data).toEqual([]);
    const self = await bob.client.rpc("respond_meeting_location", {
      p_meeting_id: meeting!.id,
      p_accept: true,
    });
    expect(self.error).not.toBeNull();
    const ok = await alice.client.rpc("respond_meeting_location", {
      p_meeting_id: meeting!.id,
      p_accept: true,
    });
    expect(ok.data?.agreed_status).toBe("Accepted");
  });

  it("completion: both confirm → Completed, books Swapped, notifications created", async () => {
    expect((await alice.client.rpc("complete_swap", { p_swap_id: swapId })).data?.status).toBe("Accepted");
    expect((await bob.client.rpc("complete_swap", { p_swap_id: swapId })).data?.status).toBe("Completed");
    const { data: books } = await alice.client.from("books").select("status").in("id", [aliceBook, bobBook]);
    expect(books?.every((b) => b.status === "Swapped")).toBe(true);
    const { data: notes } = await alice.client
      .from("notifications")
      .select("type")
      .eq("related_swap_id", swapId);
    expect(notes?.map((n) => n.type)).toContain("swap_completed");
  });

  it("reports: users can report, only admins can act", async () => {
    const extra = await addBook(bob.client, bob.id, `Report Target ${tag}`, "Someone");
    const report = await mallory.client
      .from("reports")
      .insert({ reporter_id: mallory.id, reported_book_id: extra, reason: "Spam" });
    expect(report.error).toBeNull();
    const hide = await mallory.client.rpc("admin_set_book_visibility", { p_book_id: extra, p_hidden: true });
    expect(hide.error?.message).toMatch(/Admin access required/);
    const { data: bobSees } = await bob.client.from("reports").select("*");
    expect(bobSees).toEqual([]);
  });

  it("privacy: coordinates are never readable for other users", async () => {
    await alice.client.from("profiles").update({ geo_lat: 12.971, geo_lng: 77.594 }).eq("id", alice.id);
    const { data: raw } = await bob.client.from("profiles").select("geo_lat").eq("id", alice.id);
    expect(raw).toEqual([]);
    const viaView = await bob.client.from("public_profiles").select("*").eq("id", alice.id).single();
    expect(viaView.data).not.toHaveProperty("geo_lat");
  });
});
