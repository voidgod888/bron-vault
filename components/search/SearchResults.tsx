"use client"

import React, { useEffect, useRef, useMemo } from "react"
import { Copy, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SearchResult, groupResultsByName } from "./search-utils"
import { SearchResultItem } from "./SearchResultItem"

interface SearchResultsProps {
  searchResults: SearchResult[]
  searchQuery: string
  onDeviceSelect: (device: SearchResult) => void
  isLoading?: boolean
  hasMore?: boolean
  totalDevices?: number
  onLoadMore?: () => void
}

export function SearchResults({ 
  searchResults, 
  searchQuery, 
  onDeviceSelect,
  isLoading = false,
  hasMore = false,
  totalDevices = 0,
  onLoadMore,
}: SearchResultsProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Infinite scroll: Setup Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && onLoadMore) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    // Observe the load more trigger element
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, isLoading, onLoadMore])

  // Memoize grouped results to prevent recalculation on every render
  // This is especially important when other props like isLoading change
  const groupedResults = useMemo(() => groupResultsByName(searchResults), [searchResults])
  const displayCount = totalDevices > 0 ? totalDevices : searchResults.length

  // Don't render anything if no results and not loading and no search query
  if (searchResults.length === 0 && !isLoading && !searchQuery) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Header - only show count if we have results or finished loading */}
      {(!isLoading && (searchResults.length > 0 || totalDevices > 0)) && (
        <h2 className="text-lg font-semibold text-foreground">
          Found {displayCount.toLocaleString()} device instance(s) containing &quot;{searchQuery}&quot;
          {searchResults.length < displayCount && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              (showing {searchResults.length.toLocaleString()})
            </span>
          )}
        </h2>
      )}
      
      {/* Loading indicator */}
      {isLoading && searchResults.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <h2 className="text-lg font-semibold text-foreground">
            Searching for devices containing &quot;{searchQuery}&quot;...
          </h2>
        </div>
      )}
      
      {/* Show existing results while loading more */}
      {isLoading && searchResults.length > 0 && (
        <h2 className="text-lg font-semibold text-foreground">
          Found {displayCount.toLocaleString()} device instance(s) containing &quot;{searchQuery}&quot;
          {searchResults.length < displayCount && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              (showing {searchResults.length.toLocaleString()})
            </span>
          )}
          <span className="text-sm text-muted-foreground font-normal ml-2">
            <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
            Loading more...
          </span>
        </h2>
      )}

      <div className="grid gap-3">
        {Array.from(groupedResults.entries()).map(([deviceName, devices]) => (
          <div key={deviceName} className="space-y-2">
            {devices.length > 1 && (
              <div className="flex items-center space-x-2 mb-2">
                <Badge
                  variant="outline"
                  className="glass border-primary/30 text-primary"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {devices.length} instances of &quot;{deviceName}&quot;
                </Badge>
              </div>
            )}

            {devices.map((result, index) => (
              <SearchResultItem
                key={result.deviceId}
                result={result}
                index={index}
                totalInGroup={devices.length}
                onDeviceSelect={onDeviceSelect}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Infinite scroll trigger and loading indicator */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading more devices...</span>
            </div>
          )}
        </div>
      )}

      {/* All devices loaded message */}
      {!hasMore && searchResults.length > 0 && (
        <div className="text-center text-muted-foreground py-4 text-sm">
          All {displayCount.toLocaleString()} device(s) loaded
        </div>
      )}
    </div>
  )
}
