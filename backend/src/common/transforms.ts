import type { TransformFnParams } from 'class-transformer';

// Helpers for @Transform(...) on request DTOs. Values of other types pass
// through unchanged, so the validators still report them.

/** Removes surrounding whitespace. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Trims, and turns a blank string into undefined, so an empty optional field counts as absent. */
export const trimToUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** Trims and upper-cases, for case-insensitive codes such as a Currency or a sort order. */
export const trimToUpperCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
