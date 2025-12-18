import React from "react"
import { CloudUpload, CalendarClock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SearchResult, formatDate, normalizeLogDate, getMatchingFileNames } from "./search-utils"

interface SearchResultItemProps {
  result: SearchResult
  index: number
  totalInGroup: number
  onDeviceSelect: (device: SearchResult) => void
}

export const SearchResultItem = React.memo(({ result, index, totalInGroup, onDeviceSelect }: SearchResultItemProps) => {
  const matchingFileNames = getMatchingFileNames(result.matchingFiles)

  return (
    <Card
      className="w-full cursor-pointer glass-card border-border hover:border-primary/70 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      onClick={() => onDeviceSelect(result)}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${result.deviceName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onDeviceSelect(result)
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-foreground truncate">
                {result.deviceName}
              </h3>
              {totalInGroup > 1 && (
                <Badge
                  variant="secondary"
                  className="text-xs glass border-white/5 shrink-0"
                >
                  #{index + 1}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground font-mono opacity-70 truncate">
                ID: {result.deviceId}
              </p>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-white/5">
                  {result.matchingFiles.length.toLocaleString()} matches
                </div>
                <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-white/5">
                  {result.totalFiles.toLocaleString()} files
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground -mt-1">
            <div className="flex items-center gap-1.5">
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{formatDate(result.uploadDate || result.upload_date || "")}</span>
            </div>
            {result.logDate && (
              <>
                <span className="hidden sm:inline text-muted-foreground/20">|</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium glass border-blue-500/30 text-blue-500">
                  <CalendarClock className="w-3 h-3" />
                  <span className="text-xs">Log: {normalizeLogDate(result.logDate)}</span>
                </div>
              </>
            )}
          </div>

          {matchingFileNames.length > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-1">
              <span className="text-xs text-muted-foreground">Files:</span>
              <div className="flex flex-wrap gap-1">
                {matchingFileNames.slice(0, 2).map((fileName, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-orange-500/30 text-orange-500"
                  >
                    {fileName}
                  </div>
                ))}
                {matchingFileNames.length > 2 && (
                  <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-orange-500/30 text-orange-500">
                    +{matchingFileNames.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  )
})

SearchResultItem.displayName = "SearchResultItem"
