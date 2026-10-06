export interface TemplateSegment {
  text: string;
  /** true si el trozo es un valor interpolado (p. ej. una IP) y no texto fijo. */
  isValue: boolean;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Parte una plantilla i18n ("Escribe {{primary}} como DNS primario...") en
 * trozos de texto y valores, para que la vista resalte los valores sin
 * cambiar el texto traducido. Un placeholder sin valor queda como texto.
 */
export function splitTemplate(template: string, params: Record<string, string>): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const value = params[match[1]];
    if (value === undefined) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ text: template.slice(cursor, match.index), isValue: false });
    }
    segments.push({ text: value, isValue: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) {
    segments.push({ text: template.slice(cursor), isValue: false });
  }
  return segments;
}
