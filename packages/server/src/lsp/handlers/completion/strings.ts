import { CompletionItemKind } from 'vscode-languageserver';

import type { DocumentManager } from '@typings/lsp';
import type { CompletionItem } from 'vscode-languageserver';

/** Suggests string arguments of service, class, BrickColor, child-lookup and property-signal APIs. */
export const getStringCompletions = (
  beforeCursor: string,
  documentManager: DocumentManager,
): CompletionItem[] | undefined => {
  if (/[Gg]etService\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return documentManager.globalEnv.serviceNames
      .filter(s => s.toLowerCase().startsWith(prefix))
      .map((service, idx) => ({
        'label': service,
        'kind': CompletionItemKind.Class,
        'insertText': service,
        'sortText': `0${idx.toString().padStart(3, '0')}`,
        'preselect': idx === 0,
      }));
  }

  if (/Instance\s*\.\s*new\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return documentManager.globalEnv.creatableClasses
      .filter(c => c.toLowerCase().startsWith(prefix))
      .map((cls, idx) => ({
        'label': cls,
        'kind': CompletionItemKind.Class,
        'insertText': cls,
        'sortText': `0${idx.toString().padStart(3, '0')}`,
        'preselect': idx === 0,
      }));
  }

  if (/[Bb]rick[Cc]olor\s*\.\s*new\s*(?:\(\s*)?["'][^"']*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([^"']*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const brickColors = [
      'White',
      'Grey',
      'Light yellow',
      'Brick yellow',
      'Light green (Mint)',
      'Light reddish violet',
      'Pastel Blue',
      'Light orange brown',
      'Nougat',
      'Bright red',
      'Med. reddish violet',
      'Bright blue',
      'Bright yellow',
      'Earth orange',
      'Black',
      'Dark grey',
      'Dark green',
      'Medium green',
      'Lig. Yellowich orange',
      'Bright green',
      'Dark orange',
      'Light bluish violet',
      'Transparent',
      'Tr. Red',
      'Tr. Lg blue',
      'Tr. Blue',
      'Tr. Yellow',
      'Light blue',
      'Tr. Flu. Reddish orange',
      'Tr. Green',
      'Tr. Flu. Green',
      'Phosph. White',
      'Light red',
      'Medium red',
      'Medium blue',
      'Light grey',
      'Bright violet',
      'Br. yellowish orange',
      'Bright orange',
      'Bright bluish green',
      'Earth yellow',
      'Bright bluish violet',
      'Tr. Brown',
      'Medium bluish violet',
      'Tr. Medi. reddish violet',
      'Med. yellowish green',
      'Med. bluish green',
      'Light bluish green',
      'Br. yellowish green',
      'Lig. yellowish green',
      'Med. yellowish orange',
      'Br. reddish orange',
      'Bright reddish violet',
      'Light orange',
      'Tr. Bright bluish violet',
      'Gold',
      'Dark nougat',
      'Silver',
      'Neon orange',
      'Neon green',
      'Sand blue',
      'Sand violet',
      'Medium orange',
      'Sand yellow',
      'Earth blue',
      'Earth green',
      'Tr. Flu. Blue',
      'Sand blue metallic',
      'Sand violet metallic',
      'Sand yellow metallic',
      'Dark grey metallic',
      'Black metallic',
      'Light grey metallic',
      'Sand green',
      'Sand red',
      'Dark red',
      'Tr. Flu. Yellow',
      'Tr. Flu. Red',
      'Gun metallic',
      'Red flip/flop',
      'Yellow flip/flop',
      'Silver flip/flop',
      'Curry',
      'Fire Yellow',
      'Flame yellowish orange',
      'Reddish brown',
      'Flame reddish orange',
      'Medium stone grey',
      'Royal blue',
      'Dark Royal blue',
      'Bright reddish lilac',
      'Dark stone grey',
      'Lemon metalic',
      'Light stone grey',
      'Dark Curry',
      'Faded green',
      'Turquoise',
      'Light Royal blue',
      'Medium Royal blue',
      'Rust',
      'Brown',
      'Reddish lilac',
      'Lilac',
      'Light lilac',
      'Bright purple',
      'Light purple',
      'Light pink',
      'Light brick yellow',
      'Warm yellowish orange',
      'Cool yellow',
      'Dove blue',
      'Medium lilac',
      'Slime green',
      'Smoky grey',
      'Dark blue',
      'Parsley green',
      'Steel blue',
      'Storm blue',
      'Lapis',
      'Dark indigo',
      'Sea green',
      'Shamrock',
      'Fossil',
      'Mulberry',
      'Forest green',
      'Cadet blue',
      'Electric blue',
      'Eggplant',
      'Moss',
      'Artichoke',
      'Sage green',
      'Ghost grey',
      'Lilac',
      'Plum',
      'Olivine',
      'Laurel green',
      'Quill grey',
      'Crimson',
      'Mint',
      'Baby blue',
      'Carnation pink',
      'Persimmon',
      'Maroon',
      'Gold',
      'Daisy orange',
      'Pearl',
      'Fog',
      'Salmon',
      'Terra Cotta',
      'Cocoa',
      'Wheat',
      'Buttermilk',
      'Mauve',
      'Sunrise',
      'Tawny',
      'Rust',
      'Cashmere',
      'Khaki',
      'Lily white',
      'Seashell',
      'Burgundy',
      'Cork',
      'Burlap',
      'Beige',
      'Oyster',
      'Pine Cone',
      'Fawn brown',
      'Hurricane grey',
      'Cloudy grey',
      'Linen',
      'Copper',
      'Dirt brown',
      'Bronze',
      'Flint',
      'Dark taupe',
      'Burnt Sienna',
      'Institutional white',
      'Mid gray',
      'Really black',
      'Really red',
      'Deep orange',
      'Alder',
      'Dusty Rose',
      'Olive',
      'New Yeller',
      'Really blue',
      'Navy blue',
      'Deep blue',
      'Cyan',
      'CGA brown',
      'Magenta',
      'Pink',
      'Deep orange',
      'Teal',
      'Toothpaste',
      'Lime green',
      'Camo',
      'Grime',
      'Lavender',
      'Pastel light blue',
      'Pastel orange',
      'Pastel violet',
      'Pastel blue-green',
      'Pastel green',
      'Pastel yellow',
      'Pastel brown',
      'Royal purple',
      'Hot pink',
    ];
    return brickColors
      .filter(c => c.toLowerCase().startsWith(prefix))
      .map((color, idx) => ({
        'label': color,
        'kind': CompletionItemKind.Color,
        'insertText': color,
        'sortText': `0${idx.toString().padStart(3, '0')}`,
        'preselect': idx === 0,
      }));
  }

  if (/(?:FindFirstChild|WaitForChild|FindFirstAncestor)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys())
      if (cls.toLowerCase().startsWith(prefix))
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
    return items.slice(0, 50);
  }

  if (
    /(?:FindFirstChildOfClass|FindFirstChildWhichIsA|FindFirstAncestorOfClass|FindFirstAncestorWhichIsA)\s*(?:\(\s*)?["'][\w]*$/.test(
      beforeCursor,
    )
  ) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys())
      if (cls.toLowerCase().startsWith(prefix))
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
    return items.slice(0, 50);
  }

  if (/IsA\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    const items: CompletionItem[] = [];
    for (const cls of documentManager.globalEnv.robloxClasses.keys())
      if (cls.toLowerCase().startsWith(prefix))
        items.push({
          'label': cls,
          'kind': CompletionItemKind.Class,
        });
    return items.slice(0, 50);
  }

  if (/GetPropertyChangedSignal\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) {
    const commonProps = [
      'Name',
      'Parent',
      'Position',
      'CFrame',
      'Size',
      'Color',
      'Transparency',
      'Anchored',
      'CanCollide',
      'Visible',
      'Text',
      'Value',
      'Enabled',
      'Health',
      'MaxHealth',
      'WalkSpeed',
      'JumpPower',
      'JumpHeight',
      'Velocity',
      'AssemblyLinearVelocity',
      'AssemblyAngularVelocity',
      'Material',
      'BrickColor',
      'CanQuery',
      'CanTouch',
      'Massless',
      'RootPriority',
    ];
    const match = beforeCursor.match(/["']([\w]*)$/);
    const prefix = match?.[1]?.toLowerCase() ?? '';
    return commonProps
      .filter(p => p.toLowerCase().startsWith(prefix))
      .map(prop => ({
        'label': prop,
        'kind': CompletionItemKind.Property,
      }));
  }

  if (/(?:SetAttribute|GetAttribute)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) return undefined;

  if (/(?:GetTagged|HasTag|AddTag|RemoveTag)\s*(?:\(\s*)?["'][\w]*$/.test(beforeCursor)) return undefined;

  return undefined;
};

/** Suggests Enum names and enum items. */
export const getEnumCompletions = (
  beforeCursor: string,
  documentManager: DocumentManager,
): CompletionItem[] | undefined => {
  const enumMatch = beforeCursor.match(/Enum\.(\w+)\.(\w*)$/);
  if (enumMatch !== null) {
    const [, enumName, prefix] = enumMatch;
    if (enumName === undefined) return undefined;

    const enumType = documentManager.globalEnv.robloxEnums.get(enumName);
    if (enumType !== undefined && enumType.kind === 'Table') {
      const items: CompletionItem[] = [];
      for (const [name] of enumType.properties) {
        if (prefix !== undefined && prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false)
          continue;
        items.push({
          'label': name,
          'kind': CompletionItemKind.EnumMember,
          'detail': `Enum.${enumName}`,
        });
      }
      return items;
    }
  }

  const enumBaseMatch = beforeCursor.match(/Enum\.(\w*)$/);
  if (enumBaseMatch !== null) {
    const [, prefix] = enumBaseMatch;
    const items: CompletionItem[] = [];
    for (const enumName of documentManager.globalEnv.robloxEnums.keys()) {
      if (prefix !== undefined && prefix !== '' && enumName.toLowerCase().startsWith(prefix.toLowerCase()) === false)
        continue;
      items.push({
        'label': enumName,
        'kind': CompletionItemKind.Enum,
        'detail': 'Roblox Enum',
      });
    }
    return items;
  }

  return undefined;
};
