import { ForbiddenException } from '@nestjs/common';

/** Customer-facing message for any store that is suspended; never says why. */
export const STORE_UNAVAILABLE_MESSAGE = 'This store is currently unavailable.';

/** Serialized by AllExceptionsFilter as `{ code: 'STORE_UNAVAILABLE' }`. */
export class StoreUnavailableException extends ForbiddenException {
  constructor() {
    super({ message: STORE_UNAVAILABLE_MESSAGE, error: 'Store Unavailable' });
  }
}
