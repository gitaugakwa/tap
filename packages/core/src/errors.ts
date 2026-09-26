export class TapError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TapError";
    this.code = code;
  }
}

export class TapDecodeError extends TapError {
  constructor(message = "Malformed payment request", options?: ErrorOptions) {
    super("malformed", message, options);
    this.name = "TapDecodeError";
  }
}

export class TapPayError extends TapError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = "TapPayError";
  }
}

export class TapInputError extends TapError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = "TapInputError";
  }
}

export class TapConfigError extends TapError {
  constructor(message: string, options?: ErrorOptions) {
    super("config", message, options);
    this.name = "TapConfigError";
  }
}
