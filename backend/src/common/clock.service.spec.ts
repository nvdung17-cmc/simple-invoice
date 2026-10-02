import { ClockService } from './clock.service.js';

type ClockConfig = ConstructorParameters<typeof ClockService>[0];

function clockIn(timeZone: string): ClockService {
  const config = { get: vi.fn().mockReturnValue(timeZone) };
  return new ClockService(config as unknown as ClockConfig);
}

describe('ClockService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in APP_TIMEZONE, which can differ from the UTC date near midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T17:30:00.000Z'));
    expect(clockIn('UTC').today()).toBe('2026-06-30');
    expect(clockIn('Asia/Ho_Chi_Minh').today()).toBe('2026-07-01');
  });
});
