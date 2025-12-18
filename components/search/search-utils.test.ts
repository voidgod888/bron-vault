
import { describe, it, expect } from 'vitest'
import { groupResultsByName, SearchResult } from './search-utils'

describe('groupResultsByName', () => {
  it('should group results by deviceName', () => {
    const results: SearchResult[] = [
      {
        deviceId: '1',
        deviceName: 'Device A',
        uploadBatch: 'batch1',
        matchingFiles: [],
        matchedContent: [],
        files: [],
        totalFiles: 0,
      },
      {
        deviceId: '2',
        deviceName: 'Device A',
        uploadBatch: 'batch1',
        matchingFiles: [],
        matchedContent: [],
        files: [],
        totalFiles: 0,
      },
      {
        deviceId: '3',
        deviceName: 'Device B',
        uploadBatch: 'batch1',
        matchingFiles: [],
        matchedContent: [],
        files: [],
        totalFiles: 0,
      },
    ]

    const grouped = groupResultsByName(results)

    expect(grouped.size).toBe(2)
    expect(grouped.get('Device A')?.length).toBe(2)
    expect(grouped.get('Device B')?.length).toBe(1)
  })

  it('should handle empty input', () => {
    const results: SearchResult[] = []
    const grouped = groupResultsByName(results)
    expect(grouped.size).toBe(0)
  })
})
