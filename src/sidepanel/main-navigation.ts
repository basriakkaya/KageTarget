import type { TranslationKey } from "../i18n";

export type Category = "snapshot" | "web" | "page" | "utils";

export const MAIN_TOOL_NAVIGATION: readonly {
  id: Category;
  label: TranslationKey;
  icon: string;
}[] = [
  { id: "snapshot", label: "snapshot", icon: "⌾" },
  { id: "web", label: "web", icon: "◎" },
  { id: "page", label: "page", icon: "⌁" },
  { id: "utils", label: "utils", icon: "⌗" },
];
