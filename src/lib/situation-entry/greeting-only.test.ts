import { describe, expect, it } from "vitest";
import { isGreetingOnlyInput } from "./greeting-only";

describe("isGreetingOnlyInput", () => {
  it.each(["hi", "Hello!", "Good morning", "How are you doing?", "What's up?", "Thank you."])(
    "recognizes social-only input: %s",
    (value) => expect(isGreetingOnlyInput(value)).toBe(true),
  );

  it.each([
    "Hi, Mum fell yesterday.",
    "Hello, she has not eaten today.",
    "Thanks, her appointment is tomorrow.",
    "How are you doing with Mum's medication schedule?",
    "",
  ])("does not swallow a care update: %s", (value) => {
    expect(isGreetingOnlyInput(value)).toBe(false);
  });
});
