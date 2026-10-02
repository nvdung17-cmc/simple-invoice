import { validateSync } from 'class-validator';
import {
  IsDateOnly,
  IsOnOrAfter,
  MaxCodePoints,
  MaxDecimalPlaces,
  NoNulCharacter,
} from './validators.js';

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

class Money {
  @MaxDecimalPlaces(2)
  amount: unknown;
}

function moneyMessages(amount: unknown): string[] {
  return validateSync(Object.assign(new Money(), { amount })).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('MaxDecimalPlaces', () => {
  it.each([0, 10, 19.99, 0.01, 1_000_000])('accepts %s', (amount) => {
    expect(moneyMessages(amount)).toEqual([]);
  });

  it.each([1.005, 0.001, 1e-7])('rejects %s', (amount) => {
    expect(moneyMessages(amount)).toEqual([
      'amount must have at most 2 decimal places',
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '1.005', null])(
    'leaves %s to @IsNumber',
    (amount) => {
      expect(moneyMessages(amount)).toEqual([]);
    },
  );
});

class Limited {
  @MaxCodePoints(3)
  text: unknown;
}

function limitedMessagesFor(text: unknown): string[] {
  const limited = Object.assign(new Limited(), { text });
  return validateSync(limited).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('MaxCodePoints', () => {
  const OVER_LIMIT = 'text must be shorter than or equal to 3 characters';

  it('accepts a string at the limit, and an empty one', () => {
    expect(limitedMessagesFor('abc')).toEqual([]);
    expect(limitedMessagesFor('')).toEqual([]);
  });

  it('counts a surrogate pair as one code point', () => {
    const pair = '\u{1F600}'; // 2 UTF-16 units, 1 code point
    expect(limitedMessagesFor(`ab${pair}`)).toEqual([]);
    expect(limitedMessagesFor(`abc${pair}`)).toEqual([OVER_LIMIT]);
  });

  // U+2764 followed by a variation selector is how an emoji such as a red heart
  // is written: 2 code points, which validator.js isLength (so @MaxLength)
  // counts as 1.
  it.each([
    ['U+FE0E', '\u{FE0E}'],
    ['U+FE0F', '\u{FE0F}'],
  ])('counts %s as a code point of its own', (_name, selector) => {
    expect(limitedMessagesFor(`a\u{2764}${selector}`)).toEqual([]);
    expect(limitedMessagesFor(`ab\u{2764}${selector}`)).toEqual([OVER_LIMIT]);
  });

  it('rejects a string over the limit with the message of @MaxLength', () => {
    expect(limitedMessagesFor('abcd')).toEqual([OVER_LIMIT]);
  });

  it('leaves a value that is not a string to @IsString', () => {
    expect(limitedMessagesFor(null)).toEqual([]);
    expect(limitedMessagesFor(42)).toEqual([]);
  });
});
