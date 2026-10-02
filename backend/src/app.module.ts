import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';

/**
 * Root module: validated configuration, TypeORM (pending migrations run at
 * start-up; `synchronize` stays off) and the feature modules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        migrationsRun: true,
      }),
    }),
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
