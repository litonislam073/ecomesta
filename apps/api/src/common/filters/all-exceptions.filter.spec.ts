import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { PublicServiceUnavailableException } from './public-service-unavailable.exception';

function mockHost(response: {
  status: jest.Mock;
  json: jest.Mock;
}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/test', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  it('keeps 4xx HttpException messages for clients', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(
      new HttpException('Order not found', HttpStatus.NOT_FOUND),
      mockHost({ status, json }),
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Order not found',
      },
    });
  });

  it('redacts non-HttpException 500 messages', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const errorSpy = jest
      .spyOn((filter as unknown as { logger: { error: (...a: unknown[]) => void } }).logger, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('secret DB connection string'), mockHost({ status, json }));

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('redacts HttpException 500 messages', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    jest
      .spyOn((filter as unknown as { logger: { error: (...a: unknown[]) => void } }).logger, 'error')
      .mockImplementation(() => undefined);

    filter.catch(
      new HttpException('leaky stack detail', HttpStatus.INTERNAL_SERVER_ERROR),
      mockHost({ status, json }),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('shows the user-facing message of a PublicServiceUnavailableException', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(
      new PublicServiceUnavailableException('Please try again in a moment.', 'AI_UNAVAILABLE'),
      mockHost({ status, json }),
    );
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'AI_UNAVAILABLE', message: 'Please try again in a moment.' },
    });
  });

  it('still redacts other 503 payloads', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(
      new HttpException({ message: 'redis down at 10.0.0.5', error: 'X' }, HttpStatus.SERVICE_UNAVAILABLE),
      mockHost({ status, json }),
    );
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    });
  });
});
