import { MAX_CHARS_PER_SEGMENT, MAX_SEGMENTS } from '../config/constants';

function sanitize(text: string): string {
  return text.replace(/—/g, '-').trim();
}

export function splitIntoSegments(text: string): string[] {
  const cleaned = sanitize(text);

  if (cleaned.length <= MAX_CHARS_PER_SEGMENT) {
    return [cleaned];
  }

  const segments: string[] = [];
  let remaining = cleaned;

  while (remaining.length > 0 && segments.length < MAX_SEGMENTS) {
    if (remaining.length <= MAX_CHARS_PER_SEGMENT) {
      segments.push(remaining.trim());
      break;
    }

    const chunk = remaining.substring(0, MAX_CHARS_PER_SEGMENT);

    const sentenceBoundary = Math.max(
      chunk.lastIndexOf('. '),
      chunk.lastIndexOf('! '),
      chunk.lastIndexOf('? '),
      chunk.lastIndexOf('\n')
    );

    let cutAt: number;
    if (sentenceBoundary > MAX_CHARS_PER_SEGMENT * 0.5) {
      cutAt = sentenceBoundary + 1;
    } else {
      const lastSpace = chunk.lastIndexOf(' ');
      cutAt = lastSpace > MAX_CHARS_PER_SEGMENT * 0.4 ? lastSpace : MAX_CHARS_PER_SEGMENT;
    }

    segments.push(remaining.substring(0, cutAt).trim());
    remaining = remaining.substring(cutAt).trim();
  }

  return segments.filter((s) => s.length > 0);
}
