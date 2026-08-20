export type JobErrorClass = 'TRANSIENT' | 'VALIDATION' | 'AUTHORIZATION' | 'PROVIDER' | 'UNKNOWN';

export class PermanentJobError extends Error {
  readonly errorClass: JobErrorClass = 'VALIDATION';

  constructor(message: string, errorClass: JobErrorClass = 'VALIDATION') {
    super(message);
    this.name = 'PermanentJobError';
    this.errorClass = errorClass;
  }
}

export function classifyJobError(error: unknown): { errorClass: JobErrorClass; message: string } {
  if (error instanceof PermanentJobError) {
    return { errorClass: error.errorClass, message: error.message };
  }
  if (error instanceof Error) {
    return { errorClass: 'UNKNOWN', message: error.message };
  }
  return { errorClass: 'UNKNOWN', message: 'Unknown job failure' };
}

export function isRetryable(errorClass: JobErrorClass): boolean {
  return errorClass === 'TRANSIENT' || errorClass === 'UNKNOWN' || errorClass === 'PROVIDER';
}
