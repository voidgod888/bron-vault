import { existsSync, constants } from "fs"
import { mkdir, access } from "fs/promises"

/**
 * Ensure a directory exists and is writable.
 * If it doesn't exist, it attempts to create it.
 * If it exists but isn't writable, it throws a descriptive error.
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true })
    }
    // Check write permission
    await access(dirPath, constants.W_OK)
  } catch (error) {
    if ((error as any).code === 'EACCES') {
      throw new Error(`Permission denied: Cannot write to directory ${dirPath}. Please check directory permissions. If using Docker volumes, you may need to fix ownership (e.g., 'sudo chown -R $USER <directory>').`)
    }
    throw error
  }
}
