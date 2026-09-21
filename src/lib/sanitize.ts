const CONTROL = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\u200B-\u200F]/g;

// Emoji and pictographs (Nansen decorates some symbols, e.g. "🌱 PEPE").
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;

export function sanitizeSymbol(value: string): string {
  return value
    .normalize("NFKC")
    .replace(CONTROL, "")
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12);
}

export function sanitizeAddress(value: string): string {
  return value.normalize("NFKC").replace(CONTROL, "").trim().slice(0, 64);
}

export function sanitizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(CONTROL, "")
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}
