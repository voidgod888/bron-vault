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
  label = "Copy",
  copyMessage = "Copied!",
  className,
  variant = "ghost",
  size = "icon",
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

  const copyToClipboard = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    setHasCopied(true)
  }, [value])

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(
              "h-6 w-6 hover:bg-muted text-muted-foreground hover:text-foreground",
              className
            )}
            onClick={copyToClipboard}
            aria-label={hasCopied ? copyMessage : label}
            {...props}
          >
            {hasCopied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="sr-only">{hasCopied ? copyMessage : label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{hasCopied ? copyMessage : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
