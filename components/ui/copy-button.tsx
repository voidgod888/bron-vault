"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"

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

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(value)
      setHasCopied(true)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("h-6 w-6 p-0 hover:bg-white/10", className)}
      onClick={copyToClipboard}
      aria-label={hasCopied ? copyMessage : label}
      {...props}
    >
      {hasCopied ? (
        <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground hover:text-blue-500" aria-hidden="true" />
      )}
    </Button>
  )
}
