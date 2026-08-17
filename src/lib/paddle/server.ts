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
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
  // Fail fast rather than silently defaulting to sandbox — an unset/misspelled
  // env var in production would otherwise pair a live PADDLE_API_KEY with the
  // sandbox host with no signal until some future live-mode API call 401s.
  if (env !== "sandbox" && env !== "production") {
    throw new Error(`NEXT_PUBLIC_PADDLE_ENV must be "sandbox" or "production", got: ${env}`);
  }
  const options: PaddleOptions = {
    environment: env as Environment,
    logLevel: LogLevel.error,
  };
  return new Paddle(process.env.PADDLE_API_KEY, options);
}
