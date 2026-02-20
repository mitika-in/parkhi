export enum ErrorCode {
  Corrupt = "corrupt",
  Internal = "internal",
  Unknown = "unknown",
}

export class ParkhiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
