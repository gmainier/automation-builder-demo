import type { AutomationNode } from "../../contexts/automation-context";

export interface ConfigSectionProps {
  config: Record<string, any>;
  setConfig: (config: Record<string, any>) => void;
  node: AutomationNode;
  event?: string;
  setEvent?: (event: string) => void;
}

export interface ConfigSectionPropsWithFlow extends ConfigSectionProps {
  flowNodes: AutomationNode[];
}

// Currency symbol helper
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  MXN: "MX$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  ZAR: "R",
  THB: "฿",
  MYR: "RM",
  PHP: "₱",
  IDR: "Rp",
  VND: "₫",
  TWD: "NT$",
  TRY: "₺",
  ILS: "₪",
  CZK: "Kč",
  HUF: "Ft",
  RON: "lei",
};

export const getCurrencySymbol = (currency?: string): string => {
  if (!currency) return "$";
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
};
