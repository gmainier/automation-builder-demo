interface CurrencyData {
  symbol: string;
  name: string;
}

const CURRENCY_MAP: Record<string, CurrencyData> = {
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CAD: { symbol: "C$", name: "Canadian Dollar" },
  CHF: { symbol: "CHF", name: "Swiss Franc" },
  CNY: { symbol: "¥", name: "Chinese Yuan" },
  SEK: { symbol: "kr", name: "Swedish Krona" },
  NOK: { symbol: "kr", name: "Norwegian Krone" },
  DKK: { symbol: "kr", name: "Danish Krone" },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar" },
  SGD: { symbol: "S$", name: "Singapore Dollar" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  BRL: { symbol: "R$", name: "Brazilian Real" },
  MXN: { symbol: "$", name: "Mexican Peso" },
  KRW: { symbol: "₩", name: "South Korean Won" },
  TWD: { symbol: "NT$", name: "Taiwan Dollar" },
  THB: { symbol: "฿", name: "Thai Baht" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
  PHP: { symbol: "₱", name: "Philippine Peso" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
  VND: { symbol: "₫", name: "Vietnamese Dong" },
  ZAR: { symbol: "R", name: "South African Rand" },
  TRY: { symbol: "₺", name: "Turkish Lira" },
  PLN: { symbol: "zł", name: "Polish Złoty" },
  CZK: { symbol: "Kč", name: "Czech Koruna" },
  HUF: { symbol: "Ft", name: "Hungarian Forint" },
  ILS: { symbol: "₪", name: "Israeli Shekel" },
  AED: { symbol: "د.إ", name: "UAE Dirham" },
  SAR: { symbol: "﷼", name: "Saudi Riyal" },
  EGP: { symbol: "£", name: "Egyptian Pound" },
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  KES: { symbol: "KSh", name: "Kenyan Shilling" },
  MAD: { symbol: "د.م.", name: "Moroccan Dirham" },
  TND: { symbol: "د.ت", name: "Tunisian Dinar" },
  CLP: { symbol: "$", name: "Chilean Peso" },
  COP: { symbol: "$", name: "Colombian Peso" },
  PEN: { symbol: "S/", name: "Peruvian Sol" },
  ARS: { symbol: "$", name: "Argentine Peso" },
  RUB: { symbol: "₽", name: "Russian Ruble" },
};

export function getCurrencySymbol(currencyCode: string): string {
  const code = typeof currencyCode === "string" ? currencyCode : String(currencyCode ?? "");
  return CURRENCY_MAP[code.toUpperCase()]?.symbol || code || "$";
}

export function getCurrencyName(currencyCode: string): string {
  const code = typeof currencyCode === "string" ? currencyCode : String(currencyCode ?? "");
  return CURRENCY_MAP[code.toUpperCase()]?.name || code || "USD";
}

export function formatCurrency(amount: number, currencyCode: string = "USD"): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCurrencyCompact(amount: number, currencyCode: string = "USD"): string {
  const symbol = getCurrencySymbol(currencyCode);

  if (amount >= 1000000) {
    return `${symbol}${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}K`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}
