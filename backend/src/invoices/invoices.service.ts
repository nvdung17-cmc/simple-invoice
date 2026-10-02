import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { Brackets, In, QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service.js';
import { CURRENCY_SYMBOLS } from './domain/currencies.js';
import { STATUS_CRITERIA } from './domain/invoice-status.js';
import { calculateInvoiceTotals } from './domain/invoice-totals.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import {
  ListInvoicesQueryDto,
  type SortField,
} from './dto/list-invoices-query.dto.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

/** The unique index on lower(invoice_number): the only uniqueness check. */
export const INVOICE_NUMBER_UNIQUE_INDEX = 'invoices_invoice_number_lower_uq';

/** The whitelist of sort keys. Without sortBy, the list is sorted by creation time. */
const SORT_PROPERTIES: Record<SortField | 'createdAt', keyof Invoice> = {
  createdAt: 'createdAt',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  totalAmount: 'totalAmount',
};

/** Escapes the LIKE wildcards (and the escape character), so a keyword matches literally. */
export function escapeLike(keyword: string): string {
  return keyword.replace(/[\\%_]/g, '\\$&');
}

/** A PostgreSQL unique violation (23505) on the given constraint or index. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint: violated } = error.driverError as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === '23505' && violated === constraint;
}

/** Reads and creates Invoices. Each request reads "today" once, so every row agrees on Overdue. */
@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly items: Repository<InvoiceItem>,
    private readonly clock: ClockService,
  ) {}

  /** One page of Invoices plus the total that match the filters (spec §5.3). */
  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const qb = this.invoices.createQueryBuilder('invoice');

    if (query.keyword) {
      const pattern = `%${escapeLike(query.keyword)}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('invoice.invoiceNumber ILIKE :pattern', { pattern })
            .orWhere('invoice.customerFullname ILIKE :pattern', { pattern });
        }),
      );
    }

    if (query.status) {
      // The same criteria that derive the displayed Status (invoice-status.ts).
      const criteria = STATUS_CRITERIA[query.status];
      qb.andWhere('invoice.status IN (:...storedIn)', {
        storedIn: criteria.storedIn,
      });
      if (criteria.due === 'beforeToday') {
        qb.andWhere('invoice.dueDate < :today', { today });
      } else if (criteria.due === 'todayOrLater') {
        qb.andWhere('invoice.dueDate >= :today', { today });
      }
    }

    if (query.fromDate) {
      qb.andWhere('invoice.invoiceDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('invoice.invoiceDate <= :toDate', { toDate: query.toDate });
    }

    const sortProperty = SORT_PROPERTIES[query.sortBy ?? 'createdAt'];
    const [rows, total] = await qb
      .orderBy(`invoice.${sortProperty}`, query.ordering)
      .addOrderBy('invoice.invoiceId', query.ordering)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    await this.attachItems(rows);
    return {
      data: rows.map((invoice) => toInvoiceDto(invoice, today)),
      paging: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findOne(invoiceId: string): Promise<InvoiceDto> {
    const invoice = await this.invoices.findOne({
      where: { invoiceId },
      relations: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return toInvoiceDto(invoice, this.clock.today());
  }

  /**
   * Creates a Draft Invoice with its one item (spec §5.3, create flow). The
   * totals are computed here, never taken from the client. `save` writes the
   * Invoice and its item in one transaction. The unique index is the only
   * uniqueness check, so two concurrent requests cannot both succeed.
   */
  async create(dto: CreateInvoiceDto, createdBy: string): Promise<InvoiceDto> {
    const [item] = dto.items;
    const totals = calculateInvoiceTotals({
      items: [{ quantity: item.quantity, rate: item.rate }],
      taxRate: dto.taxRate,
      discount: dto.discount,
    });
    const invoice = this.invoices.create({
      invoiceNumber: dto.invoiceNumber,
      invoiceReference: dto.invoiceReference ?? null,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      currencySymbol: CURRENCY_SYMBOLS[dto.currency],
      description: dto.description ?? null,
      status: 'Draft',
      customerFullname: dto.customer.fullname,
      customerEmail: dto.customer.email,
      customerMobileNumber: dto.customer.mobileNumber ?? null,
      customerAddress: dto.customer.address ?? null,
      taxRate: new Decimal(dto.taxRate),
      invoiceSubTotal: totals.subTotal,
      totalTax: totals.taxAmount,
      totalDiscount: totals.discount,
      totalAmount: totals.totalAmount,
      totalPaid: totals.totalPaid,
      balanceAmount: totals.balanceAmount,
      createdBy,
      items: [
        this.items.create({
          name: item.name,
          quantity: item.quantity,
          rate: new Decimal(item.rate),
        }),
      ],
    });

    let saved: Invoice;
    try {
      saved = await this.invoices.save(invoice);
    } catch (error) {
      if (isUniqueViolation(error, INVOICE_NUMBER_UNIQUE_INDEX)) {
        throw new ConflictException(
          `Invoice number ${dto.invoiceNumber} already exists`,
        );
      }
      throw error;
    }
    // Reload, so the response has the database values and the computed Status.
    return this.findOne(saved.invoiceId);
  }

  /** Loads the items of a whole page in one query (no N+1). */
  private async attachItems(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;
    const items = await this.items.find({
      where: { invoiceId: In(invoices.map((invoice) => invoice.invoiceId)) },
      order: { id: 'ASC' },
    });
    const byInvoice = new Map<string, InvoiceItem[]>();
    for (const item of items) {
      const list = byInvoice.get(item.invoiceId) ?? [];
      list.push(item);
      byInvoice.set(item.invoiceId, list);
    }
    for (const invoice of invoices) {
      invoice.items = byInvoice.get(invoice.invoiceId) ?? [];
    }
  }
}
