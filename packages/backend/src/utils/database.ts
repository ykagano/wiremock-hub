import path from 'path'
import fs from 'fs'

/**
 * Get the default database file path relative to the project root's data/ directory.
 * @param dirname - The __dirname of the calling module
 * @param levelsToRoot - Number of directory levels from dirname to project root
 * @returns Absolute path to the database file
 */
export function getDefaultDatabasePath(dirname: string, levelsToRoot: number): string {
  const relativePath = '../'.repeat(levelsToRoot) + 'data/wiremock-hub.db'
  return path.resolve(dirname, relativePath)
}

/**
 * Get the database URL, using environment variable or default path.
 * @param dirname - The __dirname of the calling module
 * @param levelsToRoot - Number of directory levels from dirname to project root
 * @returns Database URL with file: prefix
 */
export function getDatabaseUrl(dirname: string, levelsToRoot: number): string {
  return process.env.DATABASE_URL || `file:${getDefaultDatabasePath(dirname, levelsToRoot)}`
}

/**
 * Migrate database file from old location (packages/backend/data/) to new location (project root data/).
 * This ensures existing users don't lose their data after upgrading.
 * @param dirname - The __dirname of the calling module
 * @param levelsToRoot - Number of directory levels from dirname to project root
 * @returns true if migration was performed, false otherwise
 */
export function migrateDatabase(dirname: string, levelsToRoot: number): boolean {
  // Skip migration if DATABASE_URL is explicitly set
  if (process.env.DATABASE_URL) {
    return false
  }

  const projectRoot = path.resolve(dirname, '../'.repeat(levelsToRoot))
  const oldPath = path.join(projectRoot, 'packages/backend/data/wiremock-hub.db')
  const newPath = path.join(projectRoot, 'data/wiremock-hub.db')
  const newDir = path.dirname(newPath)

  // Check if migration is needed
  if (!fs.existsSync(oldPath) || fs.existsSync(newPath)) {
    return false
  }

  // Create new directory if needed
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true })
  }

  // Move database file
  fs.renameSync(oldPath, newPath)
  console.log(`[Database Migration] Moved database from ${oldPath} to ${newPath}`)

  return true
}

