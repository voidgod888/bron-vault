export const formatDate = (dateString: string) => {
  if (!dateString) return "N/A"
  try {
    // Handle MySQL datetime format 'YYYY-MM-DD HH:mm:ss'
    let isoString = dateString
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
      isoString = dateString.replace(' ', 'T') + 'Z' // treat as UTC
    }
    let date = new Date(isoString)
    if (isNaN(date.getTime())) {
      // fallback: parse manually
      const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
      if (parts) {
        return `${parts[3]}/${parts[2]}/${parts[1]} ${parts[4]}:${parts[5]}:${parts[6]}`
      }
      return dateString
    }
    // Format as MM/DD/YYYY HH:MM:SS (24-hour format)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
  } catch (e) {
    return dateString
  }
}

export const normalizeLogDate = (logDate: string | null | undefined): string => {
  if (!logDate) return "N/A"

  try {
    let date: Date | null = null
    const trimmedDate = logDate.trim()

    // Extract date part and time part separately
    const parts = trimmedDate.split(' ')
    const datePart = parts[0]
    const timePart = parts.slice(1).join(' ') // Keep all remaining parts as time (could be "HH:MM:SS" or "HH:MM:SS CEST")

    // Try DD/MM/YYYY format (with or without time) - European format
    const ddmmyyyySlash = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyySlash) {
      const [, day, month, year] = ddmmyyyySlash
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }

    // Try DD.MM.YYYY format (with or without time) - European format
    if (!date || isNaN(date.getTime())) {
      const ddmmyyyyDot = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      if (ddmmyyyyDot) {
        const [, day, month, year] = ddmmyyyyDot
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }

    // Try YYYY-MM-DD format (with or without time) - ISO format
    if (!date || isNaN(date.getTime())) {
      const yyyymmdd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (yyyymmdd) {
        const [, year, month, day] = yyyymmdd
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }

    // Try YYYY/MM/DD format (with or without time)
    if (!date || isNaN(date.getTime())) {
      const yyyymmddSlash = datePart.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
      if (yyyymmddSlash) {
        const [, year, month, day] = yyyymmddSlash
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }

    // Try MM/DD/YYYY format (US format) - check this after DD/MM/YYYY to avoid ambiguity
    if (!date || isNaN(date.getTime())) {
      // Only try if we haven't matched DD/MM/YYYY pattern
      const mmddyyyy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (mmddyyyy && !ddmmyyyySlash) {
        const [, month, day, year] = mmddyyyy
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }

    // Try text formats with month names
    if (!date || isNaN(date.getTime())) {
      // Try "June 28, 2025" or "Jun 28, 2025"
      const monthFirst = trimmedDate.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})/)
      if (monthFirst) {
        date = new Date(monthFirst[0])
      }
    }

    if (!date || isNaN(date.getTime())) {
      // Try "28 Jun 2025" or "28 June 2025"
      const dayFirst = trimmedDate.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/)
      if (dayFirst) {
        date = new Date(dayFirst[0])
      }
    }

    // Fallback: try native Date parsing
    if (!date || isNaN(date.getTime())) {
      date = new Date(trimmedDate)
    }

    // If we successfully parsed the date, format it as MM/DD/YYYY
    if (date && !isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = date.getFullYear()
      const normalizedDate = `${month}/${day}/${year}`

      // If there's a time part, append it
      if (timePart && timePart.trim()) {
        // Clean up time part - remove timezone abbreviations if present, keep just time
        const timeOnly = timePart.replace(/\s+[A-Z]{2,}$/i, '').trim() // Remove timezone like "CEST"
        return `${normalizedDate} ${timeOnly}`
      }

      return normalizedDate
    }

    // Fallback: return original if we can't parse it
    return logDate
  } catch (e) {
    return logDate
  }
}

export const getMatchingFileNames = (matchingFiles: string[]) => {
  return matchingFiles.map((filePath) => {
    const fileName = filePath.split("/").pop() || filePath
    return fileName
  })
}

export interface StoredFile {
  file_path: string
  file_name: string
  parent_path: string
  is_directory: boolean
  file_size?: number
  has_content: boolean
}

export interface SearchResult {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[]
  matchedContent: string[]
  files: StoredFile[]
  totalFiles: number
  upload_date?: string
  uploadDate?: string
  logDate?: string
  operatingSystem?: string
  ipAddress?: string
  username?: string
  hostname?: string
  country?: string
  filePath?: string
}

export const groupResultsByName = (results: SearchResult[]) => {
  const grouped = new Map<string, SearchResult[]>()
  results.forEach((result) => {
    if (!grouped.has(result.deviceName)) {
      grouped.set(result.deviceName, [])
    }
    grouped.get(result.deviceName)!.push(result)
  })
  return grouped
}
