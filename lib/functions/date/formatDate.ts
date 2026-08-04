// format tokens to match date-fns https://date-fns.org/v4.1.0/docs/format BUT we coerce everything the case to lowercase

export type DateToken =
  | "d" // Day of month
  | "do" // 1st, 2nd, ..., 31st
  | "dd" // Day of month (2 digits)
  | "w" // Local week of year
  | "wo" // 1st, 2nd, ..., 53th
  | "ww" // 01, 02, ..., 53
  | "m" // Month
  | "mo" // 1st, 2nd, ..., 12th
  | "mm" // 01, 02, ..., 12
  | "mmm" // Jan, Feb, ..., Dec
  | "y" // 44, 1, 1900, 2017
  | "yo" // 44th, 1st, 0th, 17th
  | "yy" // 44, 01, 00, 17
  | "yyy" // 044, 001, 1900, 2017
  | "yyyy"; // 0044, 0001, 1900, 2017

export const ALLOWED_DATE_TOKENS: DateToken[] = [
  "d", // Day of month
  "do", // 1st, 2nd, ..., 31st
  "dd", // Day of month (2 digits)
  "w", // Local week of year
  "wo", // 1st, 2nd, ..., 53th
  "ww", // 01, 02, ..., 53
  "m", // Month
  "mo", // 1st, 2nd, ..., 12th
  "mm", // 01, 02, ..., 12
  "mmm", // Jan, Feb, ..., Dec
  "y", // 44, 1, 1900, 2017
  "yo", // 44th, 1st, 0th, 17th
  "yy", // 44, 01, 00, 17
  "yyy", // 044, 001, 1900, 2017
  "yyyy", // 0044, 0001, 1900, 2017
];

export const DATE_TOKEN_DEFINITIONS: Record<DateToken, string> = {
  d: "Day of month (1, 2, ..., 31)",
  do: "Day of month with ordinal (1st, 2nd, ..., 31st)",
  dd: "Day of month, zero-padded (01, 02, ..., 31)",
  w: "Week of year (1, 2, ..., 53)",
  wo: "Week of year with ordinal (1st, 2nd, ..., 53rd)",
  ww: "Week of year, zero-padded (01, 02, ..., 53)",
  m: "Month (1, 2, ..., 12)",
  mo: "Month with ordinal (1st, 2nd, ..., 12th)",
  mm: "Month, zero-padded (01, 02, ..., 12)",
  mmm: "Month, short name (Jan, Feb, ..., Dec)",
  y: "Year, any number of digits (44, 1, 1900, 2017)",
  yo: "Year with ordinal (44th, 1st, 0th, 17th)",
  yy: "Year, last two digits (44, 01, 00, 17)",
  yyy: "Year, minimum three digits (044, 001, 1900, 2017)",
  yyyy: "Year, minimum four digits (0044, 0001, 1900, 2017)",
};

export const isValidDateToken = (token: string): token is DateToken => {
  //coerce token to lowercase
  const lowerCaseToken = token.toLowerCase();
  return ALLOWED_DATE_TOKENS.includes(lowerCaseToken as DateToken);
};

// Helper function to detect if format contains special case patterns (capitals + lowercase)
const hasSpecialCasePattern = (format: string): boolean => {
  // Look for specific patterns like Www, WWww, Mmm, MMmm, Yyy, YYyy, Ddd, DDdd, etc.
  const patterns = [
    /W+w+/, // Week patterns
    /M+m+/, // Month patterns
    /D+d+/, // Day patterns
    /Y+y+/, // Year patterns
  ];
  return patterns.some((pattern) => pattern.test(format));
};

// Helper function to format special case patterns dynamically
const formatSpecialCasePattern = (date: Date, format: string): string => {
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  let result = format;

  // Define token value getters
  const getTokenValue = (token: string, dateObj: Date): string => {
    const lowerToken = token.toLowerCase();
    switch (lowerToken) {
      case "w":
        return getWeekOfYear(dateObj).toString();
      case "ww":
        return getWeekOfYear(dateObj).toString().padStart(2, "0");
      case "www":
        return getWeekOfYear(dateObj).toString().padStart(3, "0");
      case "wwww":
        return getWeekOfYear(dateObj).toString().padStart(4, "0");
      case "m":
        return (dateObj.getMonth() + 1).toString();
      case "mm":
        return (dateObj.getMonth() + 1).toString().padStart(2, "0");
      case "mmm":
        return (dateObj.getMonth() + 1).toString().padStart(3, "0");
      case "mmmm":
        return (dateObj.getMonth() + 1).toString().padStart(4, "0");
      case "d":
        return dateObj.getDate().toString();
      case "dd":
        return dateObj.getDate().toString().padStart(2, "0");
      case "ddd":
        return dateObj.getDate().toString().padStart(3, "0");
      case "dddd":
        return dateObj.getDate().toString().padStart(4, "0");
      case "y":
        return dateObj.getFullYear().toString();
      case "yy":
        return dateObj.getFullYear().toString().slice(-2);
      case "yyy":
        return dateObj.getFullYear().toString().slice(-3);
      case "yyyy":
        return dateObj.getFullYear().toString();
      default:
        return "";
    }
  };

  // Find all patterns and replace them carefully
  // Use specific patterns for each type to avoid false matches
  const patterns = [
    // Week patterns: W+w+
    { regex: /W+w+/g, capitalLetter: "W", getValue: (lowercase: string) => getTokenValue(lowercase, date) },
    // Month patterns: M+m+
    { regex: /M+m+/g, capitalLetter: "M", getValue: (lowercase: string) => getTokenValue(lowercase, date) },
    // Day patterns: D+d+
    { regex: /D+d+/g, capitalLetter: "D", getValue: (lowercase: string) => getTokenValue(lowercase, date) },
    // Year patterns: Y+y+
    { regex: /Y+y+/g, capitalLetter: "Y", getValue: (lowercase: string) => getTokenValue(lowercase, date) },
  ];

  for (const patternConfig of patterns) {
    result = result.replace(patternConfig.regex, (match) => {
      // Split into capital part and lowercase part
      const capitalRegex = new RegExp("^" + patternConfig.capitalLetter + "+");
      const capitalPart = match.match(capitalRegex)?.[0] || "";
      const lowercasePart = match.match(/[a-z]+$/)?.[0] || "";

      // Only process if the lowercase part is a valid date token
      const value = patternConfig.getValue(lowercasePart);
      if (value !== "") {
        return capitalPart + value;
      }
      return match; // Return unchanged if not a valid token
    });
  }

  return result;
};

export const formatDate = (date: Date | number, format = "yyyy-mm-dd"): string => {
  // Convert number to Date if needed
  const dateObj = typeof date === "number" ? new Date(date) : date;

  //check if date is valid
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date");
  }

  // Check if format contains any special patterns with capitals and lowercase
  if (hasSpecialCasePattern(format)) {
    return formatSpecialCasePattern(dateObj, format);
  }

  // Handle legacy special date formats for backward compatibility
  if (format === "WwwYyy") {
    const week = getWeekOfYear(dateObj).toString().padStart(2, "0");
    const year = dateObj.getFullYear().toString().slice(-2);
    return `W${week}Y${year}`;
  }

  if (format === "Www") {
    const week = getWeekOfYear(dateObj).toString().padStart(2, "0");
    return `W${week}`;
  }

  if (format === "KWww") {
    const week = getWeekOfYear(dateObj).toString().padStart(2, "0");
    return `KW${week}`;
  }

  // Parse the format into tokens (needs to handle multi-character tokens and escapes)
  let result = "";
  let i = 0;

  while (i < format.length) {
    // Check for escape character
    if (format[i] === "\\") {
      // If we have a backslash, the next character should be treated as literal
      if (i + 1 < format.length) {
        result += format[i + 1]; // Add the escaped character as literal text
        i += 2; // Skip both the backslash and the escaped character
        continue;
      } else {
        // Backslash at end of string, treat as literal
        result += "\\";
        i++;
        continue;
      }
    }

    // Check for longer tokens first (longest to shortest)

    // Check for four-character tokens
    if (i + 3 < format.length) {
      const fourCharToken = format.substring(i, i + 4).toLowerCase();
      if (isValidDateToken(fourCharToken)) {
        result += formatToken(dateObj, fourCharToken);
        i += 4;
        continue;
      }
    }

    // Check for three-character tokens
    if (i + 2 < format.length) {
      const threeCharToken = format.substring(i, i + 3).toLowerCase();
      if (isValidDateToken(threeCharToken)) {
        result += formatToken(dateObj, threeCharToken);
        i += 3;
        continue;
      }
    }

    // Check for two-character tokens
    if (i + 1 < format.length) {
      const twoCharToken = format.substring(i, i + 2).toLowerCase();
      if (isValidDateToken(twoCharToken)) {
        result += formatToken(dateObj, twoCharToken);
        i += 2;
        continue;
      }
    }

    // Single character token or delimiter
    const oneCharToken = format[i].toLowerCase();
    if (isValidDateToken(oneCharToken)) {
      result += formatToken(dateObj, oneCharToken);
    } else {
      // If not a valid token, preserve the original character (not lowercased)
      result += format[i];
    }
    i++;
  }

  return result;
};

// Helper function to format a token
function formatToken(date: Date, token: DateToken): string {
  //coerce token to lowercase
  const lowerCaseToken = token.toLowerCase();
  switch (lowerCaseToken) {
    case "d":
      return date.getDate().toString();
    case "do":
      return addOrdinalSuffix(date.getDate());
    case "dd":
      return date.getDate().toString().padStart(2, "0");
    case "w":
      return getWeekOfYear(date).toString();
    case "wo":
      return addOrdinalSuffix(getWeekOfYear(date));
    case "ww":
      return getWeekOfYear(date).toString().padStart(2, "0");
    case "mmm":
      return date.toLocaleString("default", { month: "short" });
    case "m":
      return (date.getMonth() + 1).toString(); // Months are 0-indexed
    case "mo":
      return addOrdinalSuffix(date.getMonth() + 1);
    case "mm":
      return (date.getMonth() + 1).toString().padStart(2, "0");
    case "yyyy":
      return date.getFullYear().toString();
    case "yyy":
      return date.getFullYear().toString().padStart(3, "0");
    case "yy":
      return date.getFullYear().toString().slice(-2);
    case "y":
      return date.getFullYear().toString();
    case "yo":
      return addOrdinalSuffix(date.getFullYear());
    default:
      return "";
  }
}

// Helper function to add ordinal suffix (1st, 2nd, 3rd, etc.)
export function addOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;

  if (j === 1 && k !== 11) {
    return n + "st";
  }
  if (j === 2 && k !== 12) {
    return n + "nd";
  }
  if (j === 3 && k !== 13) {
    return n + "rd";
  }
  return n + "th";
}

// Helper function to get week of year
function getWeekOfYear(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
