import crypto from 'crypto';

export function computeImportHash(
  accountId: number,
  date: string,
  amount: number,
  identifier: string
): string {
  const raw = `${accountId}|${date}|${amount.toFixed(2)}|${identifier.trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
