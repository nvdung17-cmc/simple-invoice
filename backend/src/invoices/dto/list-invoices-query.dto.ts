import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToUndefined, trimToUpperCase } from '../../common/transforms.js';
import { IsDateOnly, IsOnOrAfter } from '../../common/validators.js';
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../domain/invoice-status.js';

export const SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_ORDERS = ['ASC', 'DESC'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Maps a Status in any case to its canonical spelling; a blank value counts as absent. */
function toInvoiceStatus({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const wanted = value.trim().toLowerCase();
  if (wanted === '') return undefined;
  return INVOICE_STATUSES.find((s) => s.toLowerCase() === wanted) ?? value;
}

/** Query of GET /invoices (spec §5.3). Blank optional filters are ignored. */
export class ListInvoicesQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // TypeORM writes the offset into the SQL text, and a number of 1e21 or more
  // prints as 1e+21, which Postgres rejects: past this bound a request is a 400.
  @Max(Number.MAX_SAFE_INTEGER)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({
    enum: [...SORT_FIELDS],
    description: 'Sort key. Without it, Invoices are sorted by creation time.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: SortField;

  @ApiPropertyOptional({
    enum: [...SORT_ORDERS],
    default: 'DESC',
    description:
      'Direction of the sort key in effect (case-insensitive). The default with no sortBy is newest first.',
  })
  @Transform(trimToUpperCase)
  @IsIn(SORT_ORDERS)
  ordering: SortOrder = 'DESC';

  @ApiPropertyOptional({
    enum: [...INVOICE_STATUSES],
    description:
      'Status filter (case-insensitive). Overdue means: not Paid, and the Due Date is before today.',
  })
  @Transform(toInvoiceStatus)
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Matches part of the Invoice Number or of the Customer name, ignoring case.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-01',
    description: 'Earliest Invoice Date (inclusive).',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsDateOnly()
  fromDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-30',
    description:
      'Latest Invoice Date (inclusive); must not be before fromDate.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsDateOnly()
  @IsOnOrAfter('fromDate')
  toDate?: string;
}
