import type { ColorMatch } from '@typings/handlers';
import type { Connection, Position, TextDocuments } from 'vscode-languageserver';
import type {
  ColorInformation,
  ColorPresentation,
  ColorPresentationParams,
  DocumentColorParams,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/** Parses a regex capture that the pattern guarantees is a decimal number. */
const parseComponent = (capture: string | undefined): number => (capture === undefined ? 0 : parseFloat(capture));

/** Formats a 0-1 component with at most three decimals, trimming trailing zeros. */
const formatComponent = (value: number): string => {
  const trimmed = value.toFixed(3).replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
};

/**
 * Finds all Color3 constructor calls in source code and extracts their color values.
 * @param content - The Luau source code to scan.
 * @returns An array of color matches with position and RGB values.
 */
export const findColors = (content: string): ColorMatch[] => {
  const colors: ColorMatch[] = [];

  const fromRGBRegex = /Color3\s*\.\s*fromRGB\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = fromRGBRegex.exec(content)) !== null) {
    const r = parseComponent(match[1]) / 255;
    const g = parseComponent(match[2]) / 255;
    const b = parseComponent(match[3]) / 255;
    colors.push({
      'start': match.index,
      'end': match.index + match[0].length,
      'red': Math.min(1, Math.max(0, r)),
      'green': Math.min(1, Math.max(0, g)),
      'blue': Math.min(1, Math.max(0, b)),
      'alpha': 1,
      'type': 'fromRGB',
    });
  }

  const newRegex = /Color3\s*\.\s*new\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;

  while ((match = newRegex.exec(content)) !== null) {
    const r = parseComponent(match[1]);
    const g = parseComponent(match[2]);
    const b = parseComponent(match[3]);
    colors.push({
      'start': match.index,
      'end': match.index + match[0].length,
      'red': Math.min(1, Math.max(0, r)),
      'green': Math.min(1, Math.max(0, g)),
      'blue': Math.min(1, Math.max(0, b)),
      'alpha': 1,
      'type': 'new',
    });
  }

  const fromHexRegex = /Color3\s*\.\s*fromHex\s*\(\s*["']#?([0-9A-Fa-f]{6})["']\s*\)/g;

  while ((match = fromHexRegex.exec(content)) !== null) {
    const hex = match[1];
    if (hex === undefined) continue;
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    colors.push({
      'start': match.index,
      'end': match.index + match[0].length,
      'red': r,
      'green': g,
      'blue': b,
      'alpha': 1,
      'type': 'fromHex',
    });
  }

  return colors;
};

const offsetToPosition = (content: string, offset: number): Position => {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < content.length; i++)
    if (content[i] === '\n') {
      line++;
      character = 0;
    } else character++;

  return { line, character };
};

/** Enables color picker support for Color3 values in the editor. */
export const setupColorHandler = (connection: Connection, documents: TextDocuments<TextDocument>): void => {
  connection.onDocumentColor((params: DocumentColorParams): ColorInformation[] => {
    const doc = documents.get(params.textDocument.uri);
    if (doc === undefined) return [];

    const content = doc.getText();
    const colorMatches = findColors(content);

    return colorMatches.map(colorMatch => {
      const start = offsetToPosition(content, colorMatch.start);
      const end = offsetToPosition(content, colorMatch.end);

      return {
        'range': { start, end },
        'color': {
          'red': colorMatch.red,
          'green': colorMatch.green,
          'blue': colorMatch.blue,
          'alpha': colorMatch.alpha,
        },
      };
    });
  });

  connection.onColorPresentation((params: ColorPresentationParams): ColorPresentation[] => {
    const { color } = params;

    const presentations: ColorPresentation[] = [];

    const r255 = Math.round(color.red * 255);
    const g255 = Math.round(color.green * 255);
    const b255 = Math.round(color.blue * 255);
    presentations.push({
      'label': `Color3.fromRGB(${r255}, ${g255}, ${b255})`,
    });

    const r1 = formatComponent(color.red);
    const g1 = formatComponent(color.green);
    const b1 = formatComponent(color.blue);
    presentations.push({
      'label': `Color3.new(${r1}, ${g1}, ${b1})`,
    });

    const hex =
      `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`.toUpperCase();
    presentations.push({
      'label': `Color3.fromHex("${hex}")`,
    });

    return presentations;
  });
};
