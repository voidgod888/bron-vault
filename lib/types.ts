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
  // System Information
  fileName?: string
  operatingSystem?: string
  ipAddress?: string
  username?: string
  hostname?: string
  country?: string
  filePath?: string
}

export interface Credential {
  browser: string
  url: string
  username: string
  password: string
  filePath?: string
}

export interface Software {
  software_name: string
  version: string
  source_file: string
}

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  hasMatch: boolean
  hasContent: boolean
  size?: number
  children: TreeNode[]
  level: number
}
