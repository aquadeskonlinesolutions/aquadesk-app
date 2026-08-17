import "server-only";
import { Environment, LogLevel, Paddle, type PaddleOptions } from "@paddle/paddle-node-sdk";

// One instance, constructed lazily per call (Route Handlers are stateless
// across requests in this runtime, so there's no module-level singleton to
// reuse safely) — matches this codebase's other lib/ factory functions
// (e.g. createAdminClient) rather than a top-level side effect.
export function getPaddleInstance(): Paddle {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not set");
  }
  const options: PaddleOptions = {
    environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as Environment) ?? Environment.sandbox,
    logLevel: LogLevel.error,
  };
  return new Paddle(process.env.PADDLE_API_KEY, options);
}
