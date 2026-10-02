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
