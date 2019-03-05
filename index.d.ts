export function clearAuthorizationCache(): void;

export function createWriteStream(filePath: string): void;

export function makeTree(
  directoryPath: string,
  callback: (error: Error | null) => void
): void;

export function recursiveCopy(
  sourcePath: string,
  destinationPath: string,
  callback: (error: Error | null) => void
): void;

export function symlink(
  target: string,
  filePath: string,
  callback: (error: Error | null) => void
): void;

export function unlink(
  filePath: string,
  callback: (error: Error | null) => void
): void;
