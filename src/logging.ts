export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

export type LogFunction = (message: string) => void;

export let debug: LogFunction = console.debug;
export let info: LogFunction = console.info;
export let warn: LogFunction = console.warn;
export let error: LogFunction = console.error;

export function setLogFunction(level: LogLevel, logFunction: LogFunction) {
  if (level == LogLevel.Debug) debug = logFunction;
  else if (level == LogLevel.Info) info = logFunction;
  else if (level == LogLevel.Warn) warn = logFunction;
  else if (level == LogLevel.Error) error = logFunction;
  else throw new Error(`unknown level: ${level}`);
}
