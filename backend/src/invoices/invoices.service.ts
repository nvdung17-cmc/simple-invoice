import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service.js';
import { STATUS_CRITERIA } from './domain/invoice-status.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { InvoiceDto } from './dto/invoice.dto.js';
import {
  ListInvoicesQueryDto,
  type SortField,
} from './dto/list-invoices-query.dto.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

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

/** Reads Invoices. Each request reads "today" once, so every row agrees on Overdue. */
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
