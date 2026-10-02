import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { InvoicesService } from './invoices.service.js';

/** A malformed id is a client error with a clear message, not a database error. */
const invoiceIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('id must be a valid UUID'),
});

/** List, view and create Invoices (spec §5.3). Every route needs a token. */
@ApiTags('invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'The token is missing, invalid or expired',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List Invoices',
    description:
      'Search by Invoice Number or Customer name, filter by Status and Invoice Date range, sort, and paginate on the server.',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'A query parameter is not valid',
  })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one Invoice with its item and totals' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The invoiceId' })
  @ApiOkResponse({ type: InvoiceDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'id is not a valid UUID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Invoice not found',
  })
  findOne(@Param('id', invoiceIdPipe) id: string): Promise<InvoiceDto> {
    return this.invoices.findOne(id);
  }
}
