"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CopyButtonProps extends ButtonProps {
  value: string
  label?: string
  copyMessage?: string
}

export function CopyButton({
  value,
  className,
  variant = "ghost",
  size = "icon",
  label = "Copy",
  copyMessage = "Copied!",
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    if (hasCopied) {
      const timeout = setTimeout(() => {
        setHasCopied(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [hasCopied])

  const copyToClipboard = React.useCallback((value: string) => {
    navigator.clipboard.writeText(value)
    setHasCopied(true)
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className={cn(
              "relative z-10 h-6 w-6 text-muted-foreground hover:bg-zinc-700/50 hover:text-foreground [&_svg]:h-3 [&_svg]:w-3",
              className
            )}
            onClick={(e) => {
              e.stopPropagation()
              copyToClipboard(value)
            }}
            aria-label={hasCopied ? copyMessage : label}
            {...props}
          >
            <span className="sr-only">{label}</span>
            {hasCopied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="bg-black text-white border-zinc-800 text-xs">
           {hasCopied ? copyMessage : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
