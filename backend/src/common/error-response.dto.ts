import { ApiProperty } from '@nestjs/swagger';

/** The body of every error response (spec §5.5), for the Swagger documentation. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description:
      'A message, or one message per invalid field for validation errors (400).',
    example: 'Invoice not found',
  })
  message: string | string[];

  @ApiProperty({ example: 'Not Found', description: 'The HTTP reason phrase.' })
  error: string;
}
