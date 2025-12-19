"use client"

import { cn } from "@/lib/utils"
import { Loader2, Database, Search, Upload, BarChart3 } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  return (
    <Loader2 
      className={cn("animate-spin", sizeClasses[size], className)} 
      aria-label="Loading"
    />
  )
}

interface LoadingStateProps {
  type?: "search" | "upload" | "stats" | "chart" | "data" | "default"
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingState({ 
  type = "default", 
  message, 
  size = "md", 
  className 
}: LoadingStateProps) {
  const icons = {
    search: Search,
    upload: Upload,
    stats: BarChart3,
    chart: BarChart3,
    data: Database,
    default: Loader2
  }

  const messages = {
    search: "Searching database...",
    upload: "Processing upload...",
    stats: "Loading statistics...",
    chart: "Generating chart...",
    data: "Loading data...",
    default: "Loading..."
  }

  const Icon = icons[type]
  const defaultMessage = messages[type]

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <Icon 
        className={cn(
          "animate-spin text-primary mb-3",
          size === "sm" && "h-6 w-6",
          size === "md" && "h-8 w-8",
          size === "lg" && "h-12 w-12"
        )}
        aria-label="Loading"
      />
      <p className={cn(
        "text-muted-foreground",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-lg"
      )}>
        {message || defaultMessage}
      </p>
    </div>
  )
}

interface LoadingCardProps {
  title?: string
  description?: string
  className?: string
}

export function LoadingCard({ title, description, className }: LoadingCardProps) {
  return (
    <div className={cn(
      "glass-card rounded-lg p-6",
      className
    )}>
      <div className="animate-pulse">
        {title && (
          <div className="h-6 bg-card/40 rounded mb-4 w-3/4"></div>
        )}
        <div className="space-y-3">
          <div className="h-4 bg-card/40 rounded w-full"></div>
          <div className="h-4 bg-card/40 rounded w-5/6"></div>
          <div className="h-4 bg-card/40 rounded w-4/6"></div>
        </div>
        {description && (
          <div className="h-3 bg-card/40 rounded mt-4 w-2/3"></div>
        )}
      </div>
    </div>
  )
}

interface LoadingChartProps {
  height?: number
  className?: string
}

export function LoadingChart({ height = 300, className }: LoadingChartProps) {
  return (
    <div 
      className={cn("glass-card rounded-lg p-4", className)}
      style={{ height }}
    >
      <div className="animate-pulse h-full flex flex-col">
        {/* Chart title */}
        <div className="h-4 bg-card/40 rounded w-1/3 mb-4"></div>
        
        {/* Chart area */}
        <div className="flex-1 flex items-end justify-between space-x-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i}
              className="bg-card/40 rounded-t"
              style={{ 
                height: `${Math.random() * 80 + 20}%`,
                width: '12%'
              }}
            ></div>
          ))}
        </div>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-2 bg-card/40 rounded w-8"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

