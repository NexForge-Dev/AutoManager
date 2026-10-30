export interface NexforgeOptions {
  endpoint: string | undefined;
  ingestKey: string | undefined;
  pseudonymSecret: string | undefined;
  enabled?: boolean;
  flushIntervalMs?: number;
  timeoutMs?: number;
  /** retries after a network error / 5xx / 429 (default 2) */
  retries?: number;
  onError?: (err: unknown) => void;
}

export type NexforgeEvent =
  | "signup_started"
  | "signup_step_completed"
  | "signup_completed"
  | "onboarding_completed"
  | "session_started"
  | "feature_used"
  | "plan_viewed"
  | "plan_selected"
  | "checkout_started"
  | "trial_started"
  | "plan_activated"
  | "plan_changed"
  | "plan_canceled"
  | "payment_failed"
  | "account_deleted"
  | "identity_linked";

export interface TrackData {
  userId?: string | number;
  anonymousId?: string;
  properties?: Record<string, string | number>;
  occurredAt?: Date;
  /** fixed id for one-time events (see onceId) */
  eventId?: string;
}

export interface NexforgeClient {
  track(event: NexforgeEvent, data: TrackData): void;
  link(previousId: string, userId: string | number): void;
  /** with maxWaitMs, resolves after at most that long */
  flush(maxWaitMs?: number): Promise<void>;
  pseudonym(id: string | number): string;
  /** deterministic UUID-shaped id for one-time events */
  onceId(...parts: Array<string | number>): string;
  enabled: boolean;
}

export declare function createNexforge(opts: NexforgeOptions): NexforgeClient;
