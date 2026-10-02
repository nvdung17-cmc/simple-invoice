import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { todayIn } from './iso-date.js';

/**
 * The single source of "today": the calendar date in APP_TIMEZONE. The Overdue
 * rule reads it, and tests replace it to make Overdue deterministic.
 */
@Injectable()
export class ClockService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  today(): string {
    return todayIn(this.config.get('APP_TIMEZONE', { infer: true }));
  }
}
