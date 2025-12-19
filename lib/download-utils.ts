export const downloadDeviceData = async (deviceId: string, deviceName: string) => {
  try {
    const response = await fetch("/api/download-device", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deviceId }),
    })

    if (response.ok) {
      const blob = await response.blob()
      // Only use browser APIs in browser environment
      if (typeof window !== 'undefined' && window.URL && document) {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${deviceName}_complete_data.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        return true
      } else {
        console.error("Download not supported in this environment")
        return false
      }
    } else {
      console.error("Failed to download device data")
      return false
    }
  } catch (error) {
    console.error("Download error:", error)
    return false
  }
}
