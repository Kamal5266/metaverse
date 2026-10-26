import {
  ConfigValidationError,
  loadConfig,
  type AppConfig,
  type EnvSource,
} from '@metaverse/shared';

export type BootIO = Readonly<{
  env: EnvSource;
  writeError: (text: string) => void;
  exit: (code: number) => never;
}>;

/**
 * Loads config at process start. On invalid configuration it reports variable names and
 * reasons (never values) through `writeError` and terminates via `exit(1)`.
 * Runs before the logger exists, which is why it does not log.
 */
export function bootConfig(io: BootIO): AppConfig {
  try {
    return loadConfig(io.env);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      io.writeError(`${err.message}\n`);
      return io.exit(1);
    }
    throw err;
  }
}
