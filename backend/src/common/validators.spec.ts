import { validateSync } from 'class-validator';
import { IsDateOnly, IsOnOrAfter, NoNulCharacter } from './validators.js';

class DateRange {
  @IsDateOnly()
  start: unknown;

  @IsDateOnly()
  @IsOnOrAfter('start')
  end: unknown;
}

function messagesFor(start: unknown, end: unknown): string[] {
  const range = Object.assign(new DateRange(), { start, end });
  return validateSync(range).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('IsDateOnly', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(messagesFor('2026-02-28', '2028-02-29')).toEqual([]);
  });

  it.each(['2026-02-30', '2026-6-3', '03/06/2026', 20260603, null])(
    'rejects %s',
    (value) => {
      expect(messagesFor(value, '2026-12-31')).toEqual([
        'start must be a valid date in YYYY-MM-DD format',
      ]);
    },
  );
});

describe('IsOnOrAfter', () => {
  it('accepts the same day and later days', () => {
    expect(messagesFor('2026-06-03', '2026-06-03')).toEqual([]);
    expect(messagesFor('2026-06-03', '2026-07-03')).toEqual([]);
  });

  it('rejects an earlier day with a message that names both properties', () => {
    expect(messagesFor('2026-06-03', '2026-06-02')).toEqual([
      'end must be on or after start',
    ]);
  });

  it('leaves an invalid date to IsDateOnly', () => {
    expect(messagesFor('not-a-date', '2026-06-02')).toEqual([
      'start must be a valid date in YYYY-MM-DD format',
    ]);
  });
});

class FreeText {
  @NoNulCharacter()
  text: unknown;
}

function nulMessagesFor(text: unknown): string[] {
  const free = Object.assign(new FreeText(), { text });
  return validateSync(free).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('NoNulCharacter', () => {
  it('accepts ordinary text, including an empty string and line breaks', () => {
    expect(nulMessagesFor('')).toEqual([]);
    expect(nulMessagesFor('Nguyễn Văn An\nAcme\tPty Ltd')).toEqual([]);
  });

  it.each(['\u0000', 'a\u0000b', '\u0000b', 'a\u0000'])(
    'rejects %j',
    (text) => {
      expect(nulMessagesFor(text)).toEqual([
        'text must not contain a NUL character',
      ]);
    },
  );

  it('leaves a value that is not a string to the type validators', () => {
    expect(nulMessagesFor(null)).toEqual([]);
    expect(nulMessagesFor(42)).toEqual([]);
  });
});
