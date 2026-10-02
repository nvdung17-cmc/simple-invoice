import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import type { InvoiceDto } from './dto/invoice.dto.js';
import type { Invoice } from './entities/invoice.entity.js';
import { NotFoundException } from '@nestjs/common';
import { escapeLike, InvoicesService } from './invoices.service.js';

type Dependencies = ConstructorParameters<typeof InvoicesService>;

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves other characters alone', () => {
    expect(escapeLike('IV-178/2026#1')).toBe('IV-178/2026#1');
  });
});

describe('InvoicesService.findOne', () => {
  it('throws NotFoundException("Invoice not found") for an unknown id', async () => {
    const invoices = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new InvoicesService(
      invoices as unknown as Dependencies[0],
      {} as Dependencies[1],
      { today: () => '2026-09-15' } as Dependencies[2],
    );
    const attempt = service.findOne('5eed0000-0000-4000-8000-000000000999');
    await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
    await expect(attempt).rejects.toThrow('Invoice not found');
  });
});

describe('InvoicesService.create', () => {
  const body: CreateInvoiceDto = {
    customer: { fullname: 'Kanglee Trading', email: 'billing@kanglee.example' },
    invoiceNumber: 'INV-2026-0042',
    invoiceDate: '2026-10-02',
    dueDate: '2026-11-01',
    currency: 'USD',
    items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
    taxRate: 10,
    discount: 1.97,
  };

  function setup(save: (invoice: Invoice) => Promise<Invoice>) {
    const invoices = {
      create: vi.fn((fields: Partial<Invoice>) => fields as Invoice),
      save: vi.fn(save),
    };
    const items = { create: vi.fn((fields: object) => fields) };
    const service = new InvoicesService(
      invoices as unknown as Dependencies[0],
      items as unknown as Dependencies[1],
      { today: () => '2026-10-02' } as Dependencies[2],
    );
    const created = { invoiceId: 'new-id' } as InvoiceDto;
    const findOne = vi.spyOn(service, 'findOne').mockResolvedValue(created);
    return { service, invoices, findOne, created };
  }

  function uniqueViolation(constraint: string): QueryFailedError {
    return new QueryFailedError(
      'INSERT INTO "invoices"',
      [],
      Object.assign(
        new Error('duplicate key value violates unique constraint'),
        {
          code: '23505',
          constraint,
        },
      ),
    );
  }

  it('saves a Draft with server-computed totals, then returns the reloaded Invoice', async () => {
    const { service, invoices, findOne, created } = setup(async (invoice) =>
      // Like TypeORM's save: fill in the generated id on the same object.
      Object.assign(invoice, { invoiceId: 'new-id' }),
    );

    await expect(service.create(body, 'user-id')).resolves.toBe(created);

    const saved = invoices.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      invoiceNumber: 'INV-2026-0042',
      invoiceReference: null,
      description: null,
      status: 'Draft',
      currency: 'USD',
      currencySymbol: 'US$',
      customerFullname: 'Kanglee Trading',
      customerMobileNumber: null,
      customerAddress: null,
      createdBy: 'user-id',
    });
    expect(saved.taxRate.toFixed(2)).toBe('10.00');
    expect(saved.invoiceSubTotal.toFixed(2)).toBe('59.97');
    expect(saved.totalTax.toFixed(2)).toBe('6.00');
    expect(saved.totalDiscount.toFixed(2)).toBe('1.97');
    expect(saved.totalAmount.toFixed(2)).toBe('64.00');
    expect(saved.totalPaid.toFixed(2)).toBe('0.00');
    expect(saved.balanceAmount.toFixed(2)).toBe('64.00');
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]).toMatchObject({ name: 'Consulting', quantity: 3 });
    expect(saved.items[0].rate.toFixed(2)).toBe('19.99');
    expect(findOne).toHaveBeenCalledWith('new-id');
  });

  it('turns a duplicate Invoice Number into 409 with the number in the message', async () => {
    const { service } = setup(() =>
      Promise.reject(uniqueViolation('invoices_invoice_number_lower_uq')),
    );
    const attempt = service.create(body, 'user-id');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'Invoice number INV-2026-0042 already exists',
    );
  });

  it('rethrows other database errors', async () => {
    const other = uniqueViolation('some_other_index');
    const { service } = setup(() => Promise.reject(other));
    await expect(service.create(body, 'user-id')).rejects.toBe(other);
  });
});
