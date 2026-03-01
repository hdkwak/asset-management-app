import iconv from 'iconv-lite';

// encoding-japanese has no types shipped — use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Encoding = require('encoding-japanese') as {
  detect: (data: Uint8Array) => string | false;
};

export interface DecodeResult {
  text: string;
  detected: string;
}

/**
 * Detect encoding of a buffer and decode to a UTF-8 string.
 * Priority: UTF-8 BOM → encoding-japanese detection → iconv-lite fallback.
 */
export function detectAndDecode(buffer: Buffer): DecodeResult {
  // 1. UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { text: buffer.slice(3).toString('utf-8'), detected: 'UTF-8 BOM' };
  }

  // 2. Use encoding-japanese on up to first 4 KB for speed
  try {
    const sample = new Uint8Array(buffer.slice(0, Math.min(buffer.length, 4096)));
    const detected = Encoding.detect(sample);

    if (detected === 'EUCJP' || detected === 'EUC-KR') {
      return { text: iconv.decode(buffer, 'EUC-KR'), detected: 'EUC-KR' };
    }
    if (detected === 'SJIS') {
      return { text: iconv.decode(buffer, 'Shift_JIS'), detected: 'Shift_JIS' };
    }
    if (detected === 'UTF16' || detected === 'UTF16BE') {
      return { text: buffer.toString('utf16le'), detected: 'UTF-16' };
    }
  } catch {
    // fall through
  }

  // 3. Heuristic: scan for high EUC-KR byte pairs
  let eucPairs = 0;
  for (let i = 0; i < Math.min(buffer.length - 1, 3000); i++) {
    if (buffer[i] >= 0xA1 && buffer[i] <= 0xFE && buffer[i + 1] >= 0xA1 && buffer[i + 1] <= 0xFE) {
      eucPairs++;
    }
  }
  if (eucPairs > 3) {
    return { text: iconv.decode(buffer, 'EUC-KR'), detected: 'EUC-KR (heuristic)' };
  }

  // 4. Default: UTF-8
  return { text: buffer.toString('utf-8'), detected: 'UTF-8' };
}
