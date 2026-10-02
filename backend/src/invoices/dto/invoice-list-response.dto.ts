import { ApiProperty } from '@nestjs/swagger';
import { InvoiceDto } from './invoice.dto.js';

export class PagingDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({
    example: 41,
    description: 'Number of Invoices that match the filters, on all pages.',
  })
  total: number;
}

/** Response of GET /invoices: one page of Invoices and the paging facts. */
export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceDto] })
  data: InvoiceDto[];

  @ApiProperty({ type: PagingDto })
  paging: PagingDto;
}
