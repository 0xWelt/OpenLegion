import { Moon, Sun } from "lucide-react";

import { useTheme } from "../../hooks/use-theme";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleThemeWithTransition } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "w-9 h-9 p-0 flex items-center justify-center rounded-lg",
        "text-oc-text-muted hover:text-oc-text",
        "hover:bg-oc-surface-hover",
        "cursor-pointer transition-colors",
        className || "",
      ].join(" ")}
      onClick={(e) => {
        toggleThemeWithTransition(e);
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
