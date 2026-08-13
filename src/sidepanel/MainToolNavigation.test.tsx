import { describe, expect, it } from "vitest";
import { MAIN_TOOL_NAVIGATION } from "./main-navigation";

describe("MainToolNavigation registry", () => {
  it("keeps the four categories in their product order", () => {
    expect(MAIN_TOOL_NAVIGATION.map(({ id }) => id)).toEqual([
      "snapshot", "web", "page", "utils",
    ]);
  });

  it("provides a unique label and icon for every category", () => {
    expect(new Set(MAIN_TOOL_NAVIGATION.map(({ label }) => label)).size).toBe(4);
    expect(MAIN_TOOL_NAVIGATION.every(({ icon }) => icon.length > 0)).toBe(true);
  });
});
