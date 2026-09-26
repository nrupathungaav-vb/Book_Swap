import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { BookCover } from "@/components/books/book-cover";
import { BookStatusBadge, ConditionBadge, SwapStatusBadge } from "@/components/books/status-badges";
import { EmptyState } from "@/components/layout/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

describe("status badges", () => {
  it("communicate status with text, not colour alone", () => {
    render(
      <>
        <BookStatusBadge status="Reserved" />
        <SwapStatusBadge status="Accepted" />
        <ConditionBadge condition="Fair" />
      </>,
    );
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Fair")).toBeInTheDocument();
    expect(screen.getByText("Condition:")).toHaveClass("sr-only");
  });
});

describe("FormField", () => {
  it("wires label, description and error to the control", () => {
    render(
      <FormField
        id="title"
        label="Title"
        description="As printed on the cover"
        error="Title is required."
        required
      >
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText(/Title/);
    expect(input).toHaveAttribute("id", "title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "title-description title-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required.");
  });

  it("references the description when valid", () => {
    render(
      <FormField id="genre" label="Genre" description="Optional">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText("Genre")).toHaveAttribute("aria-describedby", "genre-description");
  });
});

describe("PasswordInput", () => {
  it("toggles visibility accessibly", async () => {
    render(
      <FormField id="pw" label="Password">
        <PasswordInput />
      </FormField>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={BookOpen}
        title="No books found."
        description="Try widening your filters."
        action={<button onClick={onClick}>Reset</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No books found." })).toBeInTheDocument();
    expect(screen.getByText("Try widening your filters.")).toBeInTheDocument();
  });
});

describe("BookCover", () => {
  it("falls back to a typographic cover when there is no image", () => {
    render(
      <BookCover
        book={{ title: "Emma", author: "Jane Austen", cover_image_url: null, google_cover_url: null }}
      />,
    );
    expect(screen.getByText("Emma")).toBeInTheDocument();
    expect(screen.getByText("Jane Austen")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
