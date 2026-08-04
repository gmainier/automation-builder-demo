import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ReadonlyURLSearchParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildQueryString } from "@/lib/functions/build-query-string";

export type QueryParamsOptions = {
  set?: Record<string, string | string[]>;
  del?: string | string[];
  replace?: boolean;
  getNewPath?: boolean;
  arrayDelimiter?: string;
};

export function useRouterUtils() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const searchParamsObj = Object.fromEntries(searchParams);

  const getQueryString = (
    kv?: Record<string, any>,
    opts?: {
      include?: string[];
      exclude?: string[];
    },
  ) => buildQueryString(searchParams, kv, opts);

  const queryParams = ({
    set,
    del,
    replace,
    scroll = true,
    getNewPath,
    arrayDelimiter = ",",
  }: {
    set?: Record<string, string | string[]>;
    del?: string | string[];
    replace?: boolean;
    scroll?: boolean;
    getNewPath?: boolean;
    arrayDelimiter?: string;
  }) => {
    const newParams = new URLSearchParams(searchParams);
    if (set) {
      Object.entries(set).forEach(([k, v]) => newParams.set(k, Array.isArray(v) ? v.join(arrayDelimiter) : v));
    }
    if (del) {
      if (Array.isArray(del)) {
        del.forEach((k) => newParams.delete(k));
      } else {
        newParams.delete(del);
      }
    }
    const queryString = newParams.toString();
    const newPath = `${pathname}${queryString.length > 0 ? `?${queryString}` : ""}`;
    if (getNewPath) return newPath;
    if (replace) {
      router.replace(newPath, { scroll: false });
    } else {
      router.push(newPath, { scroll });
    }
  };

  return {
    pathname: pathname as string,
    router: router as AppRouterInstance,
    searchParams: searchParams as ReadonlyURLSearchParams,
    searchParamsObj,
    queryParams,
    getQueryString,
  };
}
