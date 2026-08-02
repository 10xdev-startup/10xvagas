"use client"

import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // localStorage indisponível
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar tema de cor"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground shadow-surface transition hover:border-brand/40 hover:bg-accent hover:text-foreground",
        className
      )}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  )
}
