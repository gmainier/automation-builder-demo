import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact number formatting (1.2K, 3.4M). Copied from the app's lib/utils. */
export function kFormatter(num: number) {
  const absNum = Math.abs(Number(num));

  if (absNum >= 1000000000) {
    return (Math.sign(num) * (absNum / 1000000000)).toFixed(1) + "B";
  } else if (absNum >= 1000000) {
    return (Math.sign(num) * (absNum / 1000000)).toFixed(1) + "M";
  } else if (absNum >= 1000) {
    return (Math.sign(num) * (absNum / 1000)).toFixed(1) + "K";
  }

  return Math.sign(num) * Math.abs(num);
}
