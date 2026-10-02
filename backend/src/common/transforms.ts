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

/**
 * For an optional field that has a default: a blank value (as for
 * trimToUndefined) counts as absent and becomes `fallback`. Any other value goes
 * through `transform`, or stays as it is, so the validators still report an
 * invalid one.
 *
 * It returns the default rather than undefined, because an undefined result
 * would overwrite the default of the property. It judges the value the caller
 * sent (`obj[key]`), because @Type(() => Number) has already turned '' into 0
 * when a transform runs.
 */
export const defaultIfBlank =
  (
    fallback: unknown,
    transform: (params: TransformFnParams) => unknown = ({ value }) => value,
  ) =>
  (params: TransformFnParams): unknown => {
    const sent: unknown = params.obj[params.key];
    const blank = trimToUndefined({ ...params, value: sent }) === undefined;
    return blank ? fallback : transform(params);
  };
