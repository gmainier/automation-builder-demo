import { NextResponse } from "next/server";
import { countByStatus, listRules } from "@/lib/mock/automation-store";

/**
 * Catch-all for every API route this repo does not implement.
 *
 * The ported page calls around forty endpoints: approval queues, execution
 * streams, trigger previews, Slack tests, TikTok compatibility checks. Building
 * real versions of all of them is not the point of this repo, and letting them
 * 404 is worse than useless — the UI would fill with error toasts and hide the
 * builder behind failure states.
 *
 * So each returns the benign, empty-but-valid shape its caller expects. The page
 * renders as it does with a quiet account, rather than a broken one.
 *
 * Next.js matches specific routes before this catch-all, so anything with a real
 * handler (`/api/automation-rules`) is unaffected.
 */

/** Endpoints whose callers read a specific field, keyed by path. */
const CANNED_RESPONSES: Record<string, unknown> = {
  "automation/approval/pending": { count: 0, approvals: [] },
  "automation/active": { counts: { total: countByStatus("active"), scheduled: 0, delayed: 0 }, items: [] },
  "automation/notification-history": { history: [], total: 0 },
  // The banner hides itself only when `count` is 0, so this must be a number:
  // an absent field left it rendering "undefined automations were paused".
  "automation-rules/rate-limit-status": { count: 0, ruleNames: [] },
  "automation-rules/media-buffer-count": { count: 0 },
  "comment-automation-rules": { rules: [] },
  "custom-metrics": { customMetrics: [] },
  "library/boards": { boards: [] },
  "snapchat/profiles": { profiles: [] },
  "account-currency": { currency: "GBP" },
  settings: { settings: [] },
  rules: { rules: listRules() },
};

/** Everything else: a success-shaped empty object. */
const DEFAULT_RESPONSE = { ok: true, data: null, items: [], results: [] };

function respond(pathSegments: string[]) {
  const path = pathSegments.join("/");
  const canned = CANNED_RESPONSES[path];
  return NextResponse.json(canned ?? DEFAULT_RESPONSE, {
    headers: { "x-mock-endpoint": path },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return respond(path);
}

export async function POST(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return respond(path);
}

export async function PUT(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return respond(path);
}

export async function DELETE(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return respond(path);
}
