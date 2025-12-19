import { useState, useCallback, useEffect } from "react"
import { SearchResult, Credential, Software, StoredFile } from "@/lib/types"

interface DeviceSoftware extends Software {}
interface DeviceCredential extends Credential {}

export function useDeviceData(selectedDevice: SearchResult | null) {
  const [deviceCredentials, setDeviceCredentials] = useState<DeviceCredential[]>([])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string>("")

  const [deviceSoftware, setDeviceSoftware] = useState<DeviceSoftware[]>([])
  const [isLoadingSoftware, setIsLoadingSoftware] = useState(false)
  const [softwareError, setSoftwareError] = useState<string>("")

  // We need to keep local copy of files if they are fetched separately
  // but ideally they are part of selectedDevice.
  // The original code updated selectedDevice via functional update.
  // Here we can expose a way to update the parent's selectedDevice or manage extended info here.
  // Since `useSearch` manages the list of results, but `page.tsx` manages `selectedDevice` state locally.

  // We will assume `selectedDevice` is managed by the parent, but we might need to return updated info
  // to merge back. However, simple state for extra data is easier.

  // Wait, the original code updated `selectedDevice` with `operatingSystem`, `ipAddress` etc.
  // To keep it clean, we can return these extended details separately,
  // OR we can provide a callback to update the selected device if the parent allows it.
  // But `page.tsx` has `setSelectedDevice`.

  // Let's keep it simple: This hook fetches data. The parent (page.tsx) can use the data.
  // BUT `DeviceDetailsPanel` expects `selectedDevice` to have all properties.
  // So we probably need to expose `loadDeviceInfo` which calls `setSelectedDevice` passed from parent?
  // Or better, this hook manages the *loading* of that data and returns the data.
  // But `selectedDevice` in `page.tsx` is the source of truth.

  // Let's define the hook to accept `setSelectedDevice` so it can update it.

  const loadDeviceInfo = useCallback(async (deviceId: string, updateDevice: (updates: Partial<SearchResult>) => void) => {
    console.log("🚀 Starting to load device info for device:", deviceId)

    try {
      console.log("📡 Making API call to /api/device-info")
      const response = await fetch("/api/device-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const deviceInfo = await response.json()
        console.log("✅ API returned device info:", deviceInfo)

        updateDevice({
          operatingSystem: deviceInfo.operatingSystem,
          ipAddress: deviceInfo.ipAddress,
          username: deviceInfo.username,
          hostname: deviceInfo.hostname,
          country: deviceInfo.country,
          filePath: deviceInfo.filePath,
        })
      } else {
        const errorData = await response.json()
        console.error("❌ API Error loading device info:", errorData)
      }
    } catch (error) {
      console.error("❌ Failed to load device info:", error)
    }
  }, [])

  const loadDeviceCredentials = useCallback(async (deviceId: string) => {
    console.log("🚀 Starting to load credentials for device:", deviceId)
    setIsLoadingCredentials(true)
    setCredentialsError("")
    setDeviceCredentials([])

    try {
      const response = await fetch("/api/device-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const credentials = await response.json()
        console.log("✅ API returned credentials:", credentials)
        setDeviceCredentials(credentials)
      } else {
        const errorData = await response.json()
        console.error("❌ API Error:", errorData)
        setCredentialsError(`API Error: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("❌ Failed to load credentials:", error)
      setCredentialsError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoadingCredentials(false)
    }
  }, [])

  const loadDeviceSoftware = useCallback(async (deviceId: string) => {
    console.log("🚀 Starting to load software for device:", deviceId)
    setIsLoadingSoftware(true)
    setSoftwareError("")
    setDeviceSoftware([])

    try {
      const response = await fetch("/api/device-software", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const software = await response.json()
        console.log("✅ API returned software:", software)
        setDeviceSoftware(software)
      } else {
        const errorData = await response.json()
        console.error("❌ API Error:", errorData)
        setSoftwareError(`API Error: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("❌ Failed to load software:", error)
      setSoftwareError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoadingSoftware(false)
    }
  }, [])

  const loadDeviceFiles = useCallback(async (deviceId: string, updateDevice: (updates: Partial<SearchResult>) => void) => {
    console.log("🚀 Starting to load files for device:", deviceId)

    try {
      const response = await fetch("/api/device-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const deviceFilesData = await response.json()
        console.log("✅ API returned device files:", deviceFilesData)

        updateDevice({
          files: deviceFilesData.files || [],
          totalFiles: deviceFilesData.totalFiles || 0,
          matchingFiles: deviceFilesData.matchingFiles || [],
        })
      } else {
        const errorData = await response.json()
        console.error("❌ API Error loading files:", errorData)
      }
    } catch (error) {
      console.error("❌ Failed to load files:", error)
    }
  }, [])

  return {
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
  }
}
