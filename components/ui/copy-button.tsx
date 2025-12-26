"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CopyButtonProps extends ButtonProps {
  value: string
  label?: string
  successDuration?: number
}

export function CopyButton({
  value,
  className,
  variant = "ghost",
  size = "icon",
  label = "Copy to clipboard",
  successDuration = 2000,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    if (hasCopied) {
      const timeout = setTimeout(() => setHasCopied(false), successDuration)
      return () => clearTimeout(timeout)
    }
  }, [hasCopied, successDuration])

  const copyToClipboard = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation() // Prevent row selection if inside a table
      try {
        await navigator.clipboard.writeText(value)
        setHasCopied(true)
      } catch (error) {
        console.error("Failed to copy text: ", error)
      }
    },
    [value]
  )

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className={cn(
              "relative z-10 h-6 w-6 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
              className
            )}
            onClick={copyToClipboard}
            aria-label={hasCopied ? "Copied" : label}
            {...props}
          >
            <span className="sr-only">{label}</span>
            {hasCopied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {hasCopied ? "Copied!" : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
