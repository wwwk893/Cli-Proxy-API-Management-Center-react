import * as React from "react"

import { cn } from "@/lib/utils"

type CommandContextValue = {
  query: string
  setQuery: (value: string) => void
  registerMatch: (visible: boolean) => () => void
  matches: number
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommandContext(component: string) {
  const ctx = React.useContext(CommandContext)
  if (!ctx) {
    throw new Error(`${component} must be used within a <Command />`)
  }
  return ctx
}

const Command = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const [query, setQuery] = React.useState("")
    const [matches, setMatches] = React.useState(0)

    const registerMatch = React.useCallback((visible: boolean) => {
      setMatches((count) => count + (visible ? 1 : 0))
      return () => setMatches((count) => count - (visible ? 1 : 0))
    }, [])

    return (
      <CommandContext.Provider value={{ query, setQuery, registerMatch, matches }}>
        <div ref={ref} className={cn("flex flex-col gap-0.5", className)} {...props} />
      </CommandContext.Provider>
    )
  }
)
Command.displayName = "Command"

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, onChange, ...props }, ref) => {
  const { setQuery } = useCommandContext("CommandInput")

  return (
    <div className="px-3 py-2">
      <input
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
        onChange={(event) => {
          setQuery(event.target.value)
          onChange?.(event)
        }}
        {...props}
      />
    </div>
  )
})
CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("max-h-72 overflow-y-auto py-1", className)}
      role="listbox"
      {...props}
    />
  )
)
CommandList.displayName = "CommandList"

type CommandEmptyProps = React.HTMLAttributes<HTMLDivElement>

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  ({ className, ...props }, ref) => {
    const { matches } = useCommandContext("CommandEmpty")
    if (matches > 0) return null
    return (
      <div
        ref={ref}
        className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}
        {...props}
      />
    )
  }
)
CommandEmpty.displayName = "CommandEmpty"

type CommandGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  heading?: React.ReactNode
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div ref={ref} className={cn("px-2 py-1.5", className)} {...props}>
      {heading ? (
        <div className="px-2 pb-1 text-xs font-medium text-muted-foreground/80">
          {heading}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
)
CommandGroup.displayName = "CommandGroup"

type CommandItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string
  onSelect?: (value: string) => void
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value, onSelect, onClick, onKeyDown, ...props }, ref) => {
    const { query, registerMatch } = useCommandContext("CommandItem")
    const normalizedValue = value.toLowerCase()
    const visible = normalizedValue.includes(query.toLowerCase())

    React.useEffect(() => {
      const unregister = registerMatch(visible)
      return unregister
    }, [registerMatch, visible])

    if (!visible) return null

    return (
      <div
        ref={ref}
        role="option"
        aria-selected="false"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
          className
        )}
        onClick={(event) => {
          onSelect?.(value)
          onClick?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect?.(value)
          }
          onKeyDown?.(event)
        }}
        {...props}
      />
    )
  }
)
CommandItem.displayName = "CommandItem"

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn("my-1 h-px w-full bg-border", className)}
      {...props}
    />
  )
)
CommandSeparator.displayName = "CommandSeparator"

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator }
