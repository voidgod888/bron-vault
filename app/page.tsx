"use client"
export const dynamic = "force-dynamic"

import React, { useState, useEffect, useCallback } from "react"
import { Database } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TooltipProvider } from "@/components/ui/tooltip"

// Import our new components
import { SearchInterface } from "@/components/search/SearchInterface"
import { TypingEffect } from "@/components/search/TypingEffect"
import { SearchResults } from "@/components/search/SearchResults"
import { DeviceDetailsPanel } from "@/components/device/DeviceDetailsPanel"
import { FileContentDialog } from "@/components/file/FileContentDialog"

// Import custom hooks and utils
import { useStats } from "@/hooks/useStats"
import { useSearch } from "@/hooks/useSearch"
import { useDeviceData } from "@/hooks/use-device-data"
import { downloadDeviceData } from "@/lib/download-utils"
import { SearchResult } from "@/lib/types"

export default function SearchPage() {
  // Use custom hooks for state management
  const { stats, isStatsLoaded, statsError } = useStats()
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    searchType,
    setSearchType,
    handleSearch,
    detectSearchType,
    loadMore,
    pagination,
    totalDevices,
    hasSearched
  } = useSearch()

  // Local state for UI components
  const [selectedDevice, setSelectedDevice] = useState<SearchResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ deviceId: string; filePath: string; fileName: string } | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  const [credentialsSearchQuery, setCredentialsSearchQuery] = useState("")
  const [softwareSearchQuery, setSoftwareSearchQuery] = useState("")
  const [selectedFileType, setSelectedFileType] = useState<'text' | 'image' | null>(null)
  const [searchActive, setSearchActive] = useState(false)

  // Use new device data hook
  // We pass a callback to update the selected device state
  const {
    deviceCredentials,
    isLoadingCredentials,
    credentialsError,
    loadDeviceCredentials,
    deviceSoftware,
    isLoadingSoftware,
    softwareError,
    loadDeviceSoftware,
    loadDeviceInfo,
    loadDeviceFiles
  } = useDeviceData(selectedDevice)

  // Wrapper to update selected device with partial updates
  const updateSelectedDevice = useCallback((updates: Partial<SearchResult>) => {
    setSelectedDevice((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }, [])

  // Handle device selection
  const handleDeviceSelect = useCallback((device: SearchResult) => {
    console.log("🖱️ Device card clicked:", device.deviceId, device.deviceName)
    setSelectedDevice(device)
  }, [])

  // Load device info, credentials, software, and files when device is selected
  useEffect(() => {
    if (selectedDevice?.deviceId) {
      console.log("🔄 Device selected, loading data for:", selectedDevice.deviceId)
      setShowPasswords(false)
      setCredentialsSearchQuery("")
      setSoftwareSearchQuery("")

      // Load all data
      loadDeviceInfo(selectedDevice.deviceId, updateSelectedDevice)
      loadDeviceCredentials(selectedDevice.deviceId)
      loadDeviceSoftware(selectedDevice.deviceId)

      // Only load files if they haven't been loaded yet (empty array means not loaded)
      if (!selectedDevice.files || selectedDevice.files.length === 0) {
        loadDeviceFiles(selectedDevice.deviceId, updateSelectedDevice)
      }
    }
  }, [
    selectedDevice?.deviceId,
    // We only want to trigger when deviceId changes, but we need to check if files are loaded.
    // Including selectedDevice.files.length might cause loops if we aren't careful,
    // but the check `length === 0` should be safe if we only add files once.
    // Ideally we rely on deviceId changing.
    // Let's stick to deviceId for the main trigger.
    // Actually, we need to pass `updateSelectedDevice` which is stable.
  ])

  // Refined useEffect dependencies to avoid infinite loops or stale closures
  // We use a ref or separate effect if we want to be strict, but here:
  // We want to run this when selectedDevice.deviceId CHANGES.
  // The logic inside checks if files are missing.
  // So we can just depend on selectedDevice.deviceId.

  // However, `selectedDevice` object changes reference when we update it (e.g. with files).
  // So we must NOT depend on `selectedDevice` object, only `selectedDevice.deviceId`.

  // But we need to check `files.length` inside. We can use functional update or check before calling.
  // The safe way:
  // 1. Effect depends on `selectedDevice?.deviceId`.
  // 2. Inside, we can access the *current* files via `selectedDevice.files` if we include it in deps,
  //    OR we assume initial load has 0 files.
  //    BUT if we include `selectedDevice.files` in deps, updating files will re-trigger.
  //    We have `if length === 0` guard, so it won't re-fetch if files are > 0.
  //    So it is safe.

  // Re-writing the effect with proper deps:
   /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (selectedDevice?.deviceId) {
        loadDeviceInfo(selectedDevice.deviceId, updateSelectedDevice)
        loadDeviceCredentials(selectedDevice.deviceId)
        loadDeviceSoftware(selectedDevice.deviceId)

        if (!selectedDevice.files || selectedDevice.files.length === 0) {
            loadDeviceFiles(selectedDevice.deviceId, updateSelectedDevice)
        }
    }
  }, [selectedDevice?.deviceId])
  /* eslint-enable react-hooks/exhaustive-deps */


  // Prepare typing sentences for the typing effect
  const totalCreds =
    typeof stats.totalCredentials === "number" &&
    isFinite(stats.totalCredentials) &&
    !isNaN(stats.totalCredentials) &&
    stats.totalCredentials > 0
      ? stats.totalCredentials
      : null

  const validDevices = typeof stats.totalDevices === 'number' && !isNaN(stats.totalDevices)
  const validFiles = typeof stats.totalFiles === 'number' && !isNaN(stats.totalFiles)
  const validDomains = typeof stats.totalDomains === 'number' && !isNaN(stats.totalDomains)
  const validUrls = typeof stats.totalUrls === 'number' && !isNaN(stats.totalUrls)
  const validCreds = typeof totalCreds === 'number' && !isNaN(totalCreds)

  const typingSentences = isStatsLoaded && validDevices && validFiles && validDomains && validUrls && validCreds
    ? [
        `${stats.totalDevices.toLocaleString()} compromised devices, ${stats.totalFiles.toLocaleString()} files extracted.`,
        `${stats.totalDomains.toLocaleString()} total domains, ${stats.totalUrls.toLocaleString()} total urls.`,
        `${totalCreds.toLocaleString()} records ready to query...`,
      ]
    : []

  // Handle search with typing effect control
  const handleSearchWithTypingControl = async () => {
    setSearchActive(true) // Hide typing effect when searching
    await handleSearch()
  }

  // Simplified file click handler - only for text files
  const handleFileClick = async (deviceId: string, filePath: string, fileName: string, hasContent: boolean) => {
    if (!hasContent) return // Do nothing for files without content

    // Determine if file is viewable based on extension
    const fileExtension = fileName.toLowerCase().split(".").pop() || ""
    const viewableExtensions = [
      "txt",
      "log",
      "json",
      "xml",
      "html",
      "htm",
      "css",
      "js",
      "csv",
      "ini",
      "cfg",
      "conf",
      "md",
      "sql",
    ]
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
    const isViewable =
      viewableExtensions.includes(fileExtension) ||
      fileName.toLowerCase().includes("password") ||
      !fileName.includes(".")
    const isImage = imageExtensions.includes(fileExtension)

    if (!isViewable && !isImage) return // Do nothing for non-viewable/non-image files

    setSelectedFile({ deviceId, filePath, fileName })
    setIsLoadingFile(true)
    setSelectedFileType(isImage ? 'image' : 'text')

    try {
      const response = await fetch("/api/file-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, filePath }),
      })

      if (response.ok) {
        if (isImage) {
          const blob = await response.blob()
          // Only use URL.createObjectURL in browser environment
          if (typeof window !== 'undefined' && window.URL) {
            setFileContent(URL.createObjectURL(blob))
          } else {
            setFileContent("Image loading not supported in this environment")
          }
        } else {
          const data = await response.json()
          setFileContent(data.content)
        }
      } else {
        setFileContent("Error loading file content")
      }
    } catch (error) {
      setFileContent("Error loading file content")
    } finally {
      setIsLoadingFile(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 p-6 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Typing effect above search card */}
            <TypingEffect
              sentences={typingSentences}
              isVisible={isStatsLoaded && typingSentences.length > 0 && !searchActive}
            />

            {/* Search Interface */}
            <SearchInterface
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchType={searchType}
              setSearchType={setSearchType}
              isLoading={isLoading}
              onSearch={handleSearchWithTypingControl}
              onDetectSearchType={detectSearchType}
            />

            {/* Error stats alert */}
            {statsError && (
              <div className="text-center py-8">
                <Alert className="bg-card/50 border-border">
                  <Database className="h-4 w-4 text-blue" />
                  <AlertDescription className="text-foreground">
                    {statsError}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Search Results */}
            <SearchResults
              searchResults={searchResults}
              searchQuery={searchQuery}
              isLoading={isLoading}
              hasMore={pagination?.hasMore || false}
              totalDevices={totalDevices}
              onLoadMore={loadMore}
              onDeviceSelect={handleDeviceSelect}
            />

            {/* No results message - only show if search has been executed */}
            {hasSearched && searchResults.length === 0 && searchQuery && !isLoading && stats.totalFiles > 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No devices found containing &quot;{searchQuery}&quot;</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching with a different email or domain name.
                </p>
              </div>
            )}
            
            {/* Prompt to search - show when user has typed but hasn't searched yet */}
            {!hasSearched && searchQuery && !isLoading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Press Enter or click Search to find devices</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Search by email address or domain name.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Device Details Side Panel */}
        <DeviceDetailsPanel
          selectedDevice={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          deviceCredentials={deviceCredentials}
          isLoadingCredentials={isLoadingCredentials}
          credentialsError={credentialsError}
          showPasswords={showPasswords}
          setShowPasswords={setShowPasswords}
          credentialsSearchQuery={credentialsSearchQuery}
          setCredentialsSearchQuery={setCredentialsSearchQuery}
          onRetryCredentials={() => selectedDevice && loadDeviceCredentials(selectedDevice.deviceId)}
          deviceSoftware={deviceSoftware}
          isLoadingSoftware={isLoadingSoftware}
          softwareError={softwareError}
          softwareSearchQuery={softwareSearchQuery}
          setSoftwareSearchQuery={setSoftwareSearchQuery}
          onRetrySoftware={() => selectedDevice && loadDeviceSoftware(selectedDevice.deviceId)}
          onFileClick={handleFileClick}
          onDownloadAllData={downloadDeviceData}
        />

        {/* File Content Dialog */}
        <FileContentDialog
          selectedFile={selectedFile}
          onClose={() => setSelectedFile(null)}
          fileContent={fileContent}
          isLoadingFile={isLoadingFile}
          selectedFileType={selectedFileType}
          deviceName={searchResults.find((r) => r.deviceId === selectedFile?.deviceId)?.deviceName}
        />
      </div>
    </TooltipProvider>
  )
}
