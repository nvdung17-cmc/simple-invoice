/**
 * Loads `.env` into process.env for the standalone scripts (seed and
 * migrations); the API itself uses ConfigModule. Variables that are already set
 * win, and a missing file is fine: in Docker the values come from the container
 * environment.
 */
export function loadEnvFile(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
