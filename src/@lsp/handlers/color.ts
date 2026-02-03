/**
 * Color Provider Handler
 * Provides color picker support for Color3 and BrickColor values
 */

import type { Connection, TextDocuments } from 'vscode-languageserver';
import type {
  ColorInformation,
  ColorPresentation,
  ColorPresentationParams,
  DocumentColorParams,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Represents a matched Color3 expression in the document with its
 * position and normalized color values.
 * @param start - The start offset of the color expression in the document
 * @param end - The end offset of the color expression in the document
 * @param red - The red color component normalized to 0-1 range
 * @param green - The green color component normalized to 0-1 range
 * @param blue - The blue color component normalized to 0-1 range
 * @param alpha - The alpha component (always 1 for Color3)
 * @param type - The Color3 constructor type used (fromRGB, new, or fromHex)
 */
interface ColorMatch {
  readonly start: number;
  readonly end: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly type: 'fromRGB' | 'new' | 'fromHex';
}

/**
 * Finds all Color3 expressions in the document content using regex patterns.
 * Supports Color3.fromRGB (0-255), Color3.new (0-1), and Color3.fromHex formats.
 * @param content - The full document content to search
 * @returns An array of ColorMatch objects for each found Color3 expression
 */
const findColors = (content: string): ColorMatch[] => {
  const colors: ColorMatch[] = [];

  // Color3.fromRGB(r, g, b) - values 0-255
  const fromRGBRegex = /Color3\s*\.\s*fromRGB\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = fromRGBRegex.exec(content)) !== null) {
    const r = parseFloat(match[1]!) / 255;
    const g = parseFloat(match[2]!) / 255;
    const b = parseFloat(match[3]!) / 255;
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

  // Color3.new(r, g, b) - values 0-1
  const newRegex = /Color3\s*\.\s*new\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;

  while ((match = newRegex.exec(content)) !== null) {
    const r = parseFloat(match[1]!);
    const g = parseFloat(match[2]!);
    const b = parseFloat(match[3]!);
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

  // Color3.fromHex("#RRGGBB") or Color3.fromHex("RRGGBB")
  const fromHexRegex = /Color3\s*\.\s*fromHex\s*\(\s*["']#?([0-9A-Fa-f]{6})["']\s*\)/g;

  while ((match = fromHexRegex.exec(content)) !== null) {
    const hex = match[1]!;
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

/**
 * Converts a character offset in the document to a line and character position.
 * @param content - The full document content
 * @param offset - The character offset from the start of the document
 * @returns An object containing the zero-indexed line and character position
 */
const offsetToPosition = (content: string, offset: number): { line: number; character: number } => {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }

  return { line, character };
};

/**
 * Registers the color provider handlers with the LSP connection.
 * Enables color picker support for Color3 values, allowing users to
 * view and edit colors visually in the editor.
 * @param connection - The LSP connection to register the handlers on
 * @param documents - The text documents manager for accessing document content
 * @returns void
 */
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

    // Provide multiple presentation options
    const presentations: ColorPresentation[] = [];

    // Color3.fromRGB (most common in Roblox)
    const r255 = Math.round(color.red * 255);
    const g255 = Math.round(color.green * 255);
    const b255 = Math.round(color.blue * 255);
    presentations.push({
      'label': `Color3.fromRGB(${r255}, ${g255}, ${b255})`,
    });

    // Color3.new (normalized 0-1)
    const r1 = color.red.toFixed(3).replace(/\.?0+$/, '') || '0';
    const g1 = color.green.toFixed(3).replace(/\.?0+$/, '') || '0';
    const b1 = color.blue.toFixed(3).replace(/\.?0+$/, '') || '0';
    presentations.push({
      'label': `Color3.new(${r1}, ${g1}, ${b1})`,
    });

    // Color3.fromHex
    const hex =
      `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`.toUpperCase();
    presentations.push({
      'label': `Color3.fromHex("${hex}")`,
    });

    return presentations;
  });
};
