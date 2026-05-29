/**
 * ThemeToggle component
 *
 * Provides a button to toggle between light and dark themes
 */
import { useTheme } from "../contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      style={{
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: "14px",
        color: "var(--color-text-primary)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "18px" }}>
        {theme === "light" ? "🌙" : "☀️"}
      </span>
      <span>{theme === "light" ? "Dark" : "Light"}</span>
    </button>
  );
}
