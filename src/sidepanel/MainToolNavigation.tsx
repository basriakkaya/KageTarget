import { useRef, type KeyboardEvent } from "react";
import type { TranslationKey } from "../i18n";
import { MAIN_TOOL_NAVIGATION, type Category } from "./main-navigation";

type Props = {
  active: Category;
  label: (key: TranslationKey) => string;
  onSelect: (category: Category) => void;
};

export function MainToolNavigation({ active, label, onSelect }: Props) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % MAIN_TOOL_NAVIGATION.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + MAIN_TOOL_NAVIGATION.length) % MAIN_TOOL_NAVIGATION.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = MAIN_TOOL_NAVIGATION.length - 1;
    else return;
    event.preventDefault();
    const category = MAIN_TOOL_NAVIGATION[next].id;
    onSelect(category);
    tabs.current[next]?.focus();
  };

  return (
    <nav className="categories" aria-label="Tool categories" role="tablist">
      {MAIN_TOOL_NAVIGATION.map((item, index) => (
        <button
          aria-controls="tool-content"
          aria-selected={active === item.id}
          className={active === item.id ? "active" : ""}
          id={`category-tab-${item.id}`}
          key={item.id}
          onClick={() => onSelect(item.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          ref={(element) => { tabs.current[index] = element; }}
          role="tab"
          tabIndex={active === item.id ? 0 : -1}
        >
          <span className="tool-icon" aria-hidden="true">{item.icon}</span>
          <span>{label(item.label)}</span>
        </button>
      ))}
    </nav>
  );
}
