import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A 503 whose message was written for end users (e.g. "I'm having trouble
 * responding right now…"). AllExceptionsFilter shows its code and message;
 * every other 5xx stays redacted as "Internal server error".
 */
export class PublicServiceUnavailableException extends HttpException {
  constructor(
    readonly publicMessage: string,
    readonly publicCode: string,
  ) {
    super({ message: publicMessage, error: publicCode }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
