type QueryStringOptions = {
  include?: string[];
  exclude?: string[];
};

function toURLSearchParams(searchParams?: URLSearchParams | { toString(): string }) {
  if (!searchParams) {
    return new URLSearchParams();
  }

  return new URLSearchParams(searchParams.toString());
}

export function buildQueryString(
  searchParams?: URLSearchParams | { toString(): string },
  kv?: Record<string, unknown>,
  opts?: QueryStringOptions,
) {
  let newParams = toURLSearchParams(searchParams);
  const excludedKeys = new Set(opts?.exclude ?? []);

  if (opts?.include && Array.isArray(opts.include)) {
    const filteredParams = new URLSearchParams();
    newParams.forEach((value, key) => {
      if (opts.include?.includes(key)) {
        filteredParams.set(key, value);
      }
    });
    newParams = filteredParams;
  }

  excludedKeys.forEach((key) => newParams.delete(key));

  if (kv) {
    Object.entries(kv).forEach(([key, value]) => {
      if (excludedKeys.has(key) || value === undefined || value === null) {
        return;
      }

      newParams.set(key, String(value));
    });
  }

  const queryString = newParams.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}
