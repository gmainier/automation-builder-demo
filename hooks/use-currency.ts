import { useState, useEffect, useRef, useCallback } from "react";
import { normalizeMetaAdAccountIdForCurrency } from "@/lib/meta-ad-account-id";

interface UseCurrencyResult {
  currency: string;
  isLoading: boolean;
  error: string | null;
  accountName?: string;
  accountStatus?: string;
  refetch: () => void;
}

interface CurrencyResponse {
  success?: boolean;
  currency?: string;
  accountName?: string;
  accountStatus?: string;
  error?: string;
}

// Simple in-memory cache for currency per normalized Meta ad account id (survives re-renders, not page refreshes)
const currencyCache = new Map<string, { currency: string; accountName?: string; accountStatus?: string }>();
const currencyRequestCache = new Map<string, Promise<CurrencyResponse>>();

async function fetchCurrencyResponse(metaAccountId: string): Promise<CurrencyResponse> {
  const existingRequest = currencyRequestCache.get(metaAccountId);
  if (existingRequest) return existingRequest;

  const request = fetch(`/api/account-currency?businessId=${encodeURIComponent(metaAccountId)}`)
    .then(async (response) => {
      const body = (await response.json()) as CurrencyResponse;
      if (!response.ok) {
        return { ...body, success: false };
      }
      return body;
    })
    .finally(() => {
      currencyRequestCache.delete(metaAccountId);
    });

  currencyRequestCache.set(metaAccountId, request);
  return request;
}

export function useCurrency(businessId: string | null, initialCurrency?: string | null): UseCurrencyResult {
  const [currency, setCurrency] = useState<string>(initialCurrency || "USD");
  const [accountName, setAccountName] = useState<string | undefined>(undefined);
  const [accountStatus, setAccountStatus] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchCurrency = useCallback(
    async (forceRefresh = false) => {
      if (!businessId) {
        setCurrency(initialCurrency || "USD");
        setAccountName(undefined);
        setAccountStatus(undefined);
        setError(null);
        return;
      }

      const metaAccountId = normalizeMetaAdAccountIdForCurrency(businessId);
      if (!metaAccountId) {
        setCurrency(initialCurrency || "USD");
        setAccountName(undefined);
        setAccountStatus(undefined);
        setError(null);
        return;
      }

      // Skip fetch if we already have currency cached in memory (unless force refresh)
      if (!forceRefresh) {
        const cachedEntry = currencyCache.get(metaAccountId);
        if (cachedEntry) {
          setCurrency(cachedEntry.currency);
          setAccountName(cachedEntry.accountName);
          setAccountStatus(cachedEntry.accountStatus);
          return;
        }

        // Skip fetch if we already have a valid non-default currency from server-loaded settings
        if (initialCurrency && initialCurrency !== "USD") {
          setCurrency(initialCurrency);
          // Don't cache incomplete data — let a future API call fill accountName/accountStatus
          return;
        }
      } else {
        // Clear cache entry on force refresh
        currencyCache.delete(metaAccountId);
      }

      // Track this fetch to prevent race conditions
      const currentFetchId = ++fetchIdRef.current;

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchCurrencyResponse(metaAccountId);

        // Stale response — a newer fetch was triggered, discard this one
        if (currentFetchId !== fetchIdRef.current) return;

        if (!data.success) {
          setCurrency(initialCurrency || "USD");
          setAccountName(undefined);
          setAccountStatus(undefined);
          setError(data.error || "Failed to fetch currency");
          return;
        }

        if (data.success) {
          setCurrency(data.currency || "USD");
          setAccountName(data.accountName);
          setAccountStatus(data.accountStatus);
          // Cache complete data for future renders
          currencyCache.set(metaAccountId, {
            currency: data.currency || "USD",
            accountName: data.accountName,
            accountStatus: data.accountStatus,
          });
        } else {
          setCurrency(initialCurrency || "USD");
          setAccountName(undefined);
          setAccountStatus(undefined);
          setError(data.error || "Failed to fetch currency");
        }
      } catch (err) {
        // Stale response check
        if (currentFetchId !== fetchIdRef.current) return;

        console.error("Error fetching currency:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch currency");
        setCurrency(initialCurrency || "USD");
        setAccountName(undefined);
        setAccountStatus(undefined);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [businessId, initialCurrency],
  );

  useEffect(() => {
    fetchCurrency();
  }, [fetchCurrency]);

  return {
    currency,
    isLoading,
    error,
    accountName,
    accountStatus,
    refetch: () => fetchCurrency(true),
  };
}
