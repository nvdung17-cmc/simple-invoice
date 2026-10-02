import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
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
