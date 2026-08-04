/**
 * Minimal account fields available on automation history rows.
 */
export interface AffectedAccountFields {
  readonly accountId?: string | null;
  readonly accountName?: string | null;
}

/**
 * Display-ready account label parts for compact table and mobile rows.
 */
export interface AffectedAccountDisplay {
  readonly primary: string;
  readonly secondary: string | null;
  readonly title: string;
}

function normalizeAccountValue(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

/**
 * Formats the ad account affected by an automation execution for table display.
 */
export function getAffectedAccountDisplay(rule: AffectedAccountFields): AffectedAccountDisplay {
  const accountName = normalizeAccountValue(rule.accountName);
  const accountId = normalizeAccountValue(rule.accountId);

  if (accountName && accountId && accountName !== accountId) {
    return {
      primary: accountName,
      secondary: accountId,
      title: `${accountName} (${accountId})`,
    };
  }

  const primary = accountName || accountId || "-";

  return {
    primary,
    secondary: null,
    title: primary,
  };
}
