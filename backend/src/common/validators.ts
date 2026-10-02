import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import { Decimal } from 'decimal.js';
import { isIsoDate } from './iso-date.js';

/** A real calendar date in YYYY-MM-DD format: 2026-02-30 is rejected. */
export function IsDateOnly(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => isIsoDate(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid date in YYYY-MM-DD format`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * The date is on or after the date in another property of the same object,
 * e.g. dueDate on or after invoiceDate. It passes when either value is not a
 * valid date, because @IsDateOnly reports those.
 */
export function IsOnOrAfter(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isOnOrAfter',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const other = (args?.object as Record<string, unknown> | undefined)?.[
            property
          ];
          if (!isIsoDate(value) || !isIsoDate(other)) return true;
          return value >= other;
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be on or after $constraint1`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * A number with at most `places` decimal places, counted exactly with Decimal
 * (class-validator's own maxDecimalPlaces option fails on values such as 1e-7).
 * Values that are not finite numbers pass, because @IsNumber reports those.
 */
export function MaxDecimalPlaces(
  places: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxDecimalPlaces',
      constraints: [places],
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          new Decimal(value).decimalPlaces() <= places,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must have at most $constraint1 decimal places`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * The string has no NUL character (U+0000). A Postgres text value cannot hold
 * one, so the driver's error would surface as a 500 instead of a 400: put this
 * on every free-text field that is stored or searched. A value that is not a
 * string passes, because @IsString reports that.
 */
export function NoNulCharacter(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'noNulCharacter',
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' || !value.includes('\u0000'),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must not contain a NUL character`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
