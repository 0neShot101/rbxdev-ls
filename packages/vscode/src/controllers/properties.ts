import { commands, window } from 'vscode';

import { PropertiesWebviewProvider } from '#extension/propertiesWebview';
import { stripMarker } from '#extension/utils/gamePath';

import type { ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { PropertiesController } from '@typings/controllers';
import type { PropertyEntry, PropertyItem } from '@typings/properties';

/**
 * Creates the properties controller: the properties view, property edits and the edit command.
 * @param context - Extension context that owns the view and command.
 * @param client - Language client used to read and write properties.
 * @returns Operations to show an instance's properties or clear the view.
 */
export const createProperties = (context: ExtensionContext, client: LanguageClient): PropertiesController => {
  const propertiesProvider = new PropertiesWebviewProvider(context);
  context.subscriptions.push(window.registerWebviewViewProvider('rbxdev-properties', propertiesProvider));

  const refreshProperties = async (instancePath: ReadonlyArray<string>): Promise<void> => {
    const result = await client.sendRequest<{ success: boolean; properties?: PropertyEntry[] }>(
      'custom/requestProperties',
      { 'path': instancePath },
    );

    if (result.success && result.properties !== undefined)
      propertiesProvider.setProperties(
        stripMarker(instancePath[instancePath.length - 1] ?? ''),
        result.properties,
        instancePath,
      );
    else propertiesProvider.clear();
  };

  propertiesProvider.onPropertyChange(async (instancePath, property, value, valueType) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setProperty', {
        'path': instancePath,
        'property': property,
        'value': value,
        'valueType': valueType,
      });

      if (result.success) {
        await refreshProperties(instancePath);
        return true;
      }

      window.showErrorMessage(`Failed to set ${property}: ${result.error ?? 'Unknown error'}`);
      return false;
    } catch (error) {
      window.showErrorMessage(`Failed to set ${property}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  });

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.editProperty', async (item: PropertyItem) => {
      let newValue: string | undefined;

      if (item.valueType === 'boolean') {
        const selected = await window.showQuickPick(
          [
            { 'label': 'true', 'picked': item.value === 'true' },
            { 'label': 'false', 'picked': item.value === 'false' },
          ],
          { 'title': `${item.name}`, 'placeHolder': `Current: ${item.value}` },
        );
        newValue = selected?.label;
      } else if (item.valueType === 'Color3') {
        const colorPresets = [
          { 'label': '$(circle-filled) White', 'description': '1, 1, 1', 'value': '1, 1, 1' },
          { 'label': '$(circle-filled) Black', 'description': '0, 0, 0', 'value': '0, 0, 0' },
          { 'label': '$(circle-filled) Red', 'description': '1, 0, 0', 'value': '1, 0, 0' },
          { 'label': '$(circle-filled) Green', 'description': '0, 1, 0', 'value': '0, 1, 0' },
          { 'label': '$(circle-filled) Blue', 'description': '0, 0, 1', 'value': '0, 0, 1' },
          { 'label': '$(circle-filled) Yellow', 'description': '1, 1, 0', 'value': '1, 1, 0' },
          { 'label': '$(circle-filled) Cyan', 'description': '0, 1, 1', 'value': '0, 1, 1' },
          { 'label': '$(circle-filled) Magenta', 'description': '1, 0, 1', 'value': '1, 0, 1' },
          { 'label': '$(circle-filled) Orange', 'description': '1, 0.5, 0', 'value': '1, 0.5, 0' },
          { 'label': '$(circle-filled) Purple', 'description': '0.5, 0, 1', 'value': '0.5, 0, 1' },
          { 'label': '$(circle-filled) Gray', 'description': '0.5, 0.5, 0.5', 'value': '0.5, 0.5, 0.5' },
          { 'label': '$(edit) Custom RGB...', 'description': 'Enter custom values', 'value': '__custom__' },
        ];

        const selected = await window.showQuickPick(colorPresets, {
          'title': `${item.name} (Color3)`,
          'placeHolder': `Current: ${item.value}`,
        });

        if (selected?.value === '__custom__')
          newValue = await window.showInputBox({
            'prompt': `Enter RGB values (0-1)`,
            'value': item.value,
            'placeHolder': 'r, g, b (e.g., "0.5, 0.8, 1")',
            'validateInput': v => {
              if (/^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(v.trim()) === false)
                return 'Enter 3 numbers separated by commas';
              const parts = v.split(',').map(s => parseFloat(s.trim()));
              if (parts.some(n => isNaN(n) || n < 0 || n > 1)) return 'Values must be between 0 and 1';
              return undefined;
            },
          });
        else newValue = selected?.value;
      } else if (item.valueType === 'EnumItem') {
        const enumMatch = item.value.match(/^Enum\.(\w+)\.(\w+)$/);
        if (enumMatch !== null && enumMatch[1] !== undefined) {
          const enumType = enumMatch[1];

          const enumValues = new Map(
            Object.entries({
              'Material': [
                'Plastic',
                'Wood',
                'Slate',
                'Concrete',
                'CorrodedMetal',
                'DiamondPlate',
                'Foil',
                'Grass',
                'Ice',
                'Marble',
                'Granite',
                'Brick',
                'Pebble',
                'Sand',
                'Fabric',
                'SmoothPlastic',
                'Metal',
                'WoodPlanks',
                'Cobblestone',
                'Neon',
                'Glass',
                'ForceField',
              ],
              'PartType': ['Block', 'Cylinder', 'Ball', 'Wedge', 'CornerWedge'],
              'Shape': ['Block', 'Cylinder', 'Ball'],
              'Font': [
                'Legacy',
                'Arial',
                'ArialBold',
                'SourceSans',
                'SourceSansBold',
                'SourceSansSemibold',
                'SourceSansLight',
                'SourceSansItalic',
                'Bodoni',
                'Garamond',
                'Cartoon',
                'Code',
                'Highway',
                'SciFi',
                'Arcade',
                'Fantasy',
                'Antique',
                'Gotham',
                'GothamMedium',
                'GothamBold',
                'GothamBlack',
                'Ubuntu',
                'Michroma',
                'TitilliumWeb',
                'JosefinSans',
                'Oswald',
                'Merriweather',
                'Roboto',
                'RobotoMono',
                'Sarpanch',
                'SpecialElite',
                'FredokaOne',
                'Creepster',
                'IndieFlower',
                'PermanentMarker',
                'DenkOne',
                'BuilderSans',
                'BuilderSansMedium',
                'BuilderSansBold',
                'BuilderSansExtraBold',
              ],
              'SortOrder': ['LayoutOrder', 'Name', 'Custom'],
              'HorizontalAlignment': ['Center', 'Left', 'Right'],
              'VerticalAlignment': ['Center', 'Top', 'Bottom'],
              'TextXAlignment': ['Center', 'Left', 'Right'],
              'TextYAlignment': ['Center', 'Top', 'Bottom'],
              'ScaleType': ['Stretch', 'Slice', 'Tile', 'Fit', 'Crop'],
              'SizeConstraint': ['RelativeXY', 'RelativeXX', 'RelativeYY'],
              'BorderMode': ['Outline', 'Middle', 'Inset'],
              'EasingStyle': [
                'Linear',
                'Sine',
                'Back',
                'Quad',
                'Quart',
                'Quint',
                'Bounce',
                'Elastic',
                'Exponential',
                'Circular',
                'Cubic',
              ],
              'EasingDirection': ['In', 'Out', 'InOut'],
              'SurfaceType': [
                'Smooth',
                'Glue',
                'Weld',
                'Studs',
                'Inlet',
                'Universal',
                'Hinge',
                'Motor',
                'SteppingMotor',
              ],
            }),
          );

          const values = enumValues.get(enumType);
          if (values !== undefined) {
            const items = values.map(v => ({
              'label': v,
              'description': `Enum.${enumType}.${v}`,
              'picked': item.value === `Enum.${enumType}.${v}`,
            }));

            const selected = await window.showQuickPick(items, {
              'title': `${item.name} (${enumType})`,
              'placeHolder': `Current: ${item.value}`,
            });

            if (selected !== undefined) newValue = `Enum.${enumType}.${selected.label}`;
          } else
            newValue = await window.showInputBox({
              'prompt': `Edit ${item.name}`,
              'value': item.value,
              'placeHolder': 'Enum.Type.Value',
            });
        }
      } else if (item.valueType === 'BrickColor') {
        const brickColors = [
          'White',
          'Grey',
          'Light grey',
          'Black',
          'Really black',
          'Bright red',
          'Bright orange',
          'Bright yellow',
          'Bright green',
          'Bright blue',
          'Bright violet',
          'Hot pink',
          'Really red',
          'Lime green',
          'Toothpaste',
          'Cyan',
          'Deep blue',
          'Navy blue',
          'Dark green',
          'Grime',
          'Rust',
          'Maroon',
          'Brown',
          'Reddish brown',
          'Nougat',
          'Brick yellow',
          'Sand red',
          'Sand blue',
          'Sand green',
          'Teal',
          'Medium stone grey',
          'Dark stone grey',
          'Institutional white',
          'Ghost grey',
        ].map(color => ({ 'label': color, 'picked': item.value === color }));

        const selected = await window.showQuickPick(brickColors, {
          'title': `${item.name} (BrickColor)`,
          'placeHolder': `Current: ${item.value}`,
        });

        newValue = selected?.label;
      } else {
        const validateInput = (value: string): string | undefined => {
          switch (item.valueType) {
            case 'number':
              return /^-?\d*\.?\d+$/.test(value.trim()) ? undefined : 'Enter a valid number';
            case 'Vector3':
            case 'CFrame':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim())
                ? undefined
                : 'Enter 3 numbers: x, y, z';
            case 'Vector2':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim()) ? undefined : 'Enter 2 numbers: x, y';
            case 'UDim2':
              return /^\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?\s*,\s*\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?$/.test(
                value.trim(),
              )
                ? undefined
                : 'Format: {xScale, xOffset}, {yScale, yOffset}';
            default:
              return undefined;
          }
        };

        const placeholders = new Map(
          Object.entries({
            'Vector3': 'x, y, z',
            'Vector2': 'x, y',
            'CFrame': 'x, y, z',
            'UDim2': '{xScale, xOffset}, {yScale, yOffset}',
            'number': 'Enter a number',
          }),
        );

        newValue = await window.showInputBox({
          'prompt': `${item.name}`,
          'value': item.value,
          'placeHolder': placeholders.get(item.valueType) ?? `Enter value`,
          'validateInput': validateInput,
        });
      }

      if (newValue === undefined) return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setProperty', {
          'path': item.instancePath,
          'property': item.name,
          'value': newValue,
          'valueType': item.valueType,
        });

        if (result.success) await refreshProperties(item.instancePath);
        else window.showErrorMessage(`Failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  return { 'refresh': refreshProperties, 'clear': () => propertiesProvider.clear() };
};
