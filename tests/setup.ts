import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// "server-only" throws when imported outside a React Server environment; tests
// import server modules directly, so replace it with a no-op.
vi.mock("server-only", () => ({}));
