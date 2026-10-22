import type { NextApiRequest } from 'next';
import { logAdminEvent, getLatestStateRow, STATE_ACTIONS, type AdminActor } from './admin-events';

/**
 * Platform-wide execution controls.
 *
 * The kill switch is a singleton stored as the newest
 * `platform.kill_switch` row in `admin_audit_logs` (see `lib/admin-events.ts`
 * for why the audit log doubles as a state store). Every workflow execution
 * path must call `assertWorkflowExecutionAllowed()` before doing any work.
 */

export interface KillSwitchState {
  enabled: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const PAUSED: KillSwitchState = { enabled: false, reason: null, updatedAt: null, updatedBy: null };

/**
 * Short in-process cache. Reads happen on the hot path of every execution, so
 * they are memoised for a few seconds; `setKillSwitch` clears the cache in the
 * instance that handled the toggle. Other warm instances converge within TTL,
 * which is the same order as a serverless cold start.
 */
const TTL_MS = 5_000;
let cache: { state: KillSwitchState; expiresAt: number } | null = null;

export function invalidateKillSwitchCache(): void {
  cache = null;
}

export async function getKillSwitch(options: { fresh?: boolean } = {}): Promise<KillSwitchState> {
  if (!options.fresh && cache && cache.expiresAt > Date.now()) return cache.state;

  const row = await getLatestStateRow(STATE_ACTIONS.killSwitch);
  const metadata = row?.metadata ?? {};
  const state: KillSwitchState = row
    ? {
        enabled: metadata.enabled === true,
        reason: typeof metadata.reason === 'string' ? metadata.reason : null,
        updatedAt: row.createdAt.toISOString(),
        updatedBy: row.adminEmail,
      }
    : PAUSED;

  cache = { state, expiresAt: Date.now() + TTL_MS };
  return state;
}

export interface SetKillSwitchArgs {
  enabled: boolean;
  reason?: string | null;
  actor: AdminActor;
  req?: NextApiRequest;
}

export async function setKillSwitch({ enabled, reason, actor, req }: SetKillSwitchArgs): Promise<KillSwitchState> {
  await logAdminEvent({
    actor,
    action: STATE_ACTIONS.killSwitch,
    targetType: 'platform',
    targetId: 'workflow_executions',
    metadata: { enabled, reason: reason?.trim() || null },
    req,
  });
  invalidateKillSwitchCache();
  return getKillSwitch({ fresh: true });
}

export class WorkflowExecutionPausedError extends Error {
  readonly code = 'WORKFLOW_EXECUTION_PAUSED';
  readonly state: KillSwitchState;

  constructor(state: KillSwitchState) {
    super(
      state.reason
        ? `Workflow execution is paused platform-wide: ${state.reason}`
        : 'Workflow execution is paused platform-wide by an administrator.',
    );
    this.name = 'WorkflowExecutionPausedError';
    this.state = state;
  }
}

/**
 * Throws `WorkflowExecutionPausedError` when the platform kill switch is on.
 *
 * Call this at the top of every execution path — the HTTP trigger, any queue
 * consumer, and cron runners. Failing closed is deliberate: if the state cannot
 * be read we still refuse to run, rather than letting automations continue
 * against a misconfigured database.
 */
export async function assertWorkflowExecutionAllowed(): Promise<void> {
  let state: KillSwitchState;
  try {
    state = await getKillSwitch();
  } catch (error) {
    console.error('[platform-controls] kill switch unreadable; refusing to execute', error);
    throw new WorkflowExecutionPausedError({ ...PAUSED, enabled: true, reason: 'Execution state unavailable' });
  }
  if (state.enabled) throw new WorkflowExecutionPausedError(state);
}

/** Shape returned by the guard so API routes can produce a consistent body. */
export function pausedResponse(error: WorkflowExecutionPausedError) {
  return {
    success: false as const,
    error: {
      code: error.code,
      message: error.message,
      pausedSince: error.state.updatedAt,
      pausedBy: error.state.updatedBy,
    },
  };
}
