import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  buildMessage,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import {
  trim,
  trimToUndefined,
  trimToUpperCase,
} from '../../common/transforms.js';
import {
  IsDateOnly,
  IsOnOrAfter,
  MaxDecimalPlaces,
  NoNulCharacter,
} from '../../common/validators.js';
import { CURRENCY_CODES, type CurrencyCode } from '../domain/currencies.js';
import {
  calculateInvoiceTotals,
  DEFAULT_TAX_RATE,
  DiscountExceedsTotalError,
} from '../domain/invoice-totals.js';

const FINITE_NUMBER = { allowNaN: false, allowInfinity: false };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The discount must not exceed the sub-total plus tax (spec §5.3). The check
 * runs the real totals calculation, so it can never disagree with the saved
 * totals. Inputs that break their own rules are left to those rules.
 */
function DiscountWithinTotal(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'discountWithinTotal',
      validator: {
        validate: (discount: unknown, args) => {
          const body = args?.object as Partial<CreateInvoiceDto>;
          const item = Array.isArray(body.items) ? body.items[0] : undefined;
          const quantity: unknown = item?.quantity;
          const rate: unknown = item?.rate;
          const taxRate: unknown = body.taxRate;
          if (
            !isFiniteNumber(discount) ||
            !isFiniteNumber(quantity) ||
            !isFiniteNumber(rate) ||
            !isFiniteNumber(taxRate) ||
            discount < 0 ||
            quantity < 1 ||
            rate <= 0 ||
            taxRate < 0
          ) {
            return true;
          }
          try {
            calculateInvoiceTotals({
              items: [{ quantity, rate }],
              taxRate,
              discount,
            });
            return true;
          } catch (error) {
            if (error instanceof DiscountExceedsTotalError) return false;
            throw error;
          }
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must not exceed the sub-total plus tax`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/** The Customer, recorded on the Invoice as entered (ADR-0001). */
export class CustomerInputDto {
  @ApiProperty({ example: 'Paul', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @NoNulCharacter()
  @IsNotEmpty()
  @MaxLength(255)
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io', maxLength: 255 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    example: '+65 9477 1736',
    minLength: 6,
    maxLength: 20,
    description:
      'Digits, spaces, "-", "(" and ")", with an optional leading "+".',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @Length(6, 20)
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message:
      '$property must contain only digits, spaces, "-", "(" and ")", with an optional leading "+"',
  })
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Singapore', maxLength: 500 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @NoNulCharacter()
  @MaxLength(500)
  address?: string;
}

/** The one Invoice Item of a new Invoice. */
export class InvoiceItemInputDto {
  @ApiProperty({ example: 'Honda RC150', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @NoNulCharacter()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1_000_000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @ApiProperty({
    example: 1000,
    minimum: 0.01,
    maximum: 1_000_000,
    description:
      'Rate: the price of one unit; greater than 0, at most 2 decimal places.',
  })
  @IsNumber(FINITE_NUMBER)
  @IsPositive()
  @Max(1_000_000)
  @MaxDecimalPlaces(2)
  rate: number;
}

/**
 * Body of POST /invoices (spec §5.3). Totals and the Stored Status are never
 * accepted from the client: the server computes them.
 */
export class CreateInvoiceDto {
  @ApiProperty({ type: CustomerInputDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer: CustomerInputDto;

  @ApiProperty({
    example: 'INV-2026-0042',
    maxLength: 50,
    description:
      'Unique regardless of case. Starts with a letter or digit; then letters, digits and - _ / . #',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/, {
    message:
      '$property must start with a letter or digit and contain only letters, digits and - _ / . #',
  })
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662', maxLength: 100 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @NoNulCharacter()
  @MaxLength(100)
  invoiceReference?: string;

  @ApiProperty({ format: 'date', example: '2026-10-02' })
  @Transform(trim)
  @IsDateOnly()
  invoiceDate: string;

  @ApiProperty({
    format: 'date',
    example: '2026-11-01',
    description: 'On or after invoiceDate.',
  })
  @Transform(trim)
  @IsDateOnly()
  @IsOnOrAfter('invoiceDate')
  dueDate: string;

  @ApiProperty({
    enum: CURRENCY_CODES,
    example: 'AUD',
    description: 'Case-insensitive.',
  })
  @Transform(trimToUpperCase)
  @IsIn(CURRENCY_CODES, {
    message: `$property must be one of: ${CURRENCY_CODES.join(', ')}`,
  })
  currency: CurrencyCode;

  @ApiPropertyOptional({
    example: 'Invoice is issued to Kanglee',
    maxLength: 1000,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @NoNulCharacter()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    type: [InvoiceItemInputDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one item.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '$property must contain exactly 1 item' })
  @ArrayMaxSize(1, { message: '$property must contain exactly 1 item' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items: InvoiceItemInputDto[];

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 100,
    default: DEFAULT_TAX_RATE,
    description: 'Tax Rate in percent, at most 2 decimal places.',
  })
  @IsNumber(FINITE_NUMBER)
  @Min(0)
  @Max(100)
  @MaxDecimalPlaces(2)
  taxRate: number = DEFAULT_TAX_RATE;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    default: 0,
    description:
      'An amount (not a percentage), at most 2 decimal places; must not exceed the sub-total plus tax.',
  })
  @IsNumber(FINITE_NUMBER)
  @Min(0)
  @MaxDecimalPlaces(2)
  @DiscountWithinTotal()
  discount: number = 0;
}
