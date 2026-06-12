import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const fmtBRL = (n: number | string) =>
  "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number | string) => Number(n).toLocaleString("pt-BR");

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

/**
 * Intervalo [gte, lte] de um mês ancorado no horário de Brasília (UTC−3, sem DST
 * desde 2019). As datas no banco são UTC; calcular o intervalo com a hora local
 * do servidor classificaria transações na virada do mês no mês errado.
 *
 *   00:00 −03:00  ==  03:00 UTC
 */
const BRASILIA_OFFSET_HOURS = 3;
export function monthRangeBrasilia(year: number, month: number): { gte: Date; lte: Date } {
  const gte = new Date(Date.UTC(year, month - 1, 1, BRASILIA_OFFSET_HOURS, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1, BRASILIA_OFFSET_HOURS, 0, 0, 0));
  const lte = new Date(nextMonth.getTime() - 1);
  return { gte, lte };
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
