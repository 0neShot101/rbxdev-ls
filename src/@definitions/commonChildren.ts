/**
 * Common Instance Children Type Hints
 *
 * Provides smart type inference for common parent-child relationships in Roblox.
 * This module contains mappings of parent class names to their commonly accessed
 * children along with the expected child types. This enables the language server
 * to provide accurate type information when accessing children through indexing
 * operations like `model.Humanoid` or `player.Character`.
 */

/**
 * Maps parent class names to their commonly accessed children and the expected types.
 *
 * The structure is: ParentClass -> ChildName -> ExpectedChildType
 *
 * For example, a Model class commonly has a Humanoid child which is of type Humanoid,
 * and a Player instance commonly has a Character child which is of type Model.
 *
 * @example
 * ```typescript
 * const humanoidType = COMMON_CHILDREN.get('Model')?.get('Humanoid'); // 'Humanoid'
 * const characterType = COMMON_CHILDREN.get('Player')?.get('Character'); // 'Model'
 * ```
 */
export const COMMON_CHILDREN: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'Model',
    new Map([
      ['Humanoid', 'Humanoid'],
      ['HumanoidRootPart', 'BasePart'],
      ['Head', 'BasePart'],
      ['Torso', 'BasePart'],
      ['UpperTorso', 'BasePart'],
      ['LowerTorso', 'BasePart'],
      ['LeftArm', 'BasePart'],
      ['RightArm', 'BasePart'],
      ['LeftLeg', 'BasePart'],
      ['RightLeg', 'BasePart'],
      ['LeftHand', 'BasePart'],
      ['RightHand', 'BasePart'],
      ['LeftFoot', 'BasePart'],
      ['RightFoot', 'BasePart'],
      ['PrimaryPart', 'BasePart'],
      ['Animate', 'LocalScript'],
      ['Health', 'Script'],
      ['Sound', 'Script'],
    ]),
  ],
  [
    'Player',
    new Map([
      ['Character', 'Model'],
      ['Backpack', 'Backpack'],
      ['PlayerGui', 'PlayerGui'],
      ['PlayerScripts', 'PlayerScripts'],
      ['StarterGear', 'StarterGear'],
      ['leaderstats', 'Folder'],
    ]),
  ],
  [
    'Workspace',
    new Map([
      ['CurrentCamera', 'Camera'],
      ['Terrain', 'Terrain'],
    ]),
  ],
  ['Tool', new Map([['Handle', 'BasePart']])],
  ['Accessory', new Map([['Handle', 'BasePart']])],
  [
    'ScreenGui',
    new Map([
      ['Frame', 'Frame'],
      ['TextLabel', 'TextLabel'],
      ['TextButton', 'TextButton'],
      ['ImageLabel', 'ImageLabel'],
      ['ImageButton', 'ImageButton'],
      ['ScrollingFrame', 'ScrollingFrame'],
    ]),
  ],
  [
    'SurfaceGui',
    new Map([
      ['Frame', 'Frame'],
      ['TextLabel', 'TextLabel'],
      ['TextButton', 'TextButton'],
      ['ImageLabel', 'ImageLabel'],
      ['ImageButton', 'ImageButton'],
    ]),
  ],
  [
    'BillboardGui',
    new Map([
      ['Frame', 'Frame'],
      ['TextLabel', 'TextLabel'],
      ['ImageLabel', 'ImageLabel'],
    ]),
  ],
  [
    'Frame',
    new Map([
      ['UIListLayout', 'UIListLayout'],
      ['UIGridLayout', 'UIGridLayout'],
      ['UIPadding', 'UIPadding'],
      ['UICorner', 'UICorner'],
      ['UIStroke', 'UIStroke'],
      ['UIGradient', 'UIGradient'],
      ['UIAspectRatioConstraint', 'UIAspectRatioConstraint'],
      ['UISizeConstraint', 'UISizeConstraint'],
    ]),
  ],
  [
    'TextButton',
    new Map([
      ['UICorner', 'UICorner'],
      ['UIStroke', 'UIStroke'],
      ['UIPadding', 'UIPadding'],
    ]),
  ],
  [
    'TextLabel',
    new Map([
      ['UICorner', 'UICorner'],
      ['UIStroke', 'UIStroke'],
      ['UIPadding', 'UIPadding'],
    ]),
  ],
  [
    'ImageButton',
    new Map([
      ['UICorner', 'UICorner'],
      ['UIStroke', 'UIStroke'],
    ]),
  ],
  [
    'ImageLabel',
    new Map([
      ['UICorner', 'UICorner'],
      ['UIStroke', 'UIStroke'],
    ]),
  ],
  [
    'ScrollingFrame',
    new Map([
      ['UIListLayout', 'UIListLayout'],
      ['UIGridLayout', 'UIGridLayout'],
      ['UIPadding', 'UIPadding'],
    ]),
  ],
  [
    'BasePart',
    new Map([
      ['Attachment', 'Attachment'],
      ['ClickDetector', 'ClickDetector'],
      ['ProximityPrompt', 'ProximityPrompt'],
      ['Weld', 'Weld'],
      ['WeldConstraint', 'WeldConstraint'],
      ['Motor6D', 'Motor6D'],
      ['Sound', 'Sound'],
      ['ParticleEmitter', 'ParticleEmitter'],
      ['PointLight', 'PointLight'],
      ['SpotLight', 'SpotLight'],
      ['SurfaceLight', 'SurfaceLight'],
      ['Fire', 'Fire'],
      ['Smoke', 'Smoke'],
      ['Sparkles', 'Sparkles'],
      ['Decal', 'Decal'],
      ['Texture', 'Texture'],
      ['SurfaceGui', 'SurfaceGui'],
      ['BillboardGui', 'BillboardGui'],
      ['Beam', 'Beam'],
      ['Trail', 'Trail'],
      ['Highlight', 'Highlight'],
    ]),
  ],
  [
    'Humanoid',
    new Map([
      ['Animator', 'Animator'],
      ['HumanoidDescription', 'HumanoidDescription'],
    ]),
  ],
  ['Animator', new Map([['AnimationTrack', 'AnimationTrack']])],
  [
    'Sound',
    new Map([
      ['EchoSoundEffect', 'EchoSoundEffect'],
      ['ReverbSoundEffect', 'ReverbSoundEffect'],
      ['DistortionSoundEffect', 'DistortionSoundEffect'],
      ['EqualizerSoundEffect', 'EqualizerSoundEffect'],
      ['CompressorSoundEffect', 'CompressorSoundEffect'],
      ['ChorusSoundEffect', 'ChorusSoundEffect'],
      ['FlangeSoundEffect', 'FlangeSoundEffect'],
      ['PitchShiftSoundEffect', 'PitchShiftSoundEffect'],
      ['TremoloSoundEffect', 'TremoloSoundEffect'],
    ]),
  ],
  [
    'StarterPlayer',
    new Map([
      ['StarterPlayerScripts', 'StarterPlayerScripts'],
      ['StarterCharacterScripts', 'StarterCharacterScripts'],
    ]),
  ],
  [
    'ReplicatedStorage',
    new Map([
      ['Remotes', 'Folder'],
      ['Assets', 'Folder'],
      ['Modules', 'Folder'],
    ]),
  ],
  [
    'ServerStorage',
    new Map([
      ['Assets', 'Folder'],
      ['Modules', 'Folder'],
    ]),
  ],
  [
    'ServerScriptService',
    new Map([
      ['Services', 'Folder'],
      ['Modules', 'Folder'],
    ]),
  ],
  // Camera common children
  ['Camera', new Map([['CameraSubject', 'Humanoid']])],
  // Players service children
  ['Players', new Map([['LocalPlayer', 'Player']])],
  // Lighting common children
  [
    'Lighting',
    new Map([
      ['Atmosphere', 'Atmosphere'],
      ['Sky', 'Sky'],
      ['BloomEffect', 'BloomEffect'],
      ['BlurEffect', 'BlurEffect'],
      ['ColorCorrectionEffect', 'ColorCorrectionEffect'],
      ['DepthOfFieldEffect', 'DepthOfFieldEffect'],
      ['SunRaysEffect', 'SunRaysEffect'],
    ]),
  ],
  // ViewportFrame common children
  [
    'ViewportFrame',
    new Map([
      ['CurrentCamera', 'Camera'],
      ['WorldModel', 'WorldModel'],
    ]),
  ],
  // Folder - generic container
  [
    'Folder',
    new Map([
      ['Remotes', 'Folder'],
      ['Assets', 'Folder'],
    ]),
  ],
  // DataModel (game) common children
  [
    'DataModel',
    new Map([
      ['Workspace', 'Workspace'],
      ['Players', 'Players'],
      ['Lighting', 'Lighting'],
      ['ReplicatedFirst', 'ReplicatedFirst'],
      ['ReplicatedStorage', 'ReplicatedStorage'],
      ['ServerScriptService', 'ServerScriptService'],
      ['ServerStorage', 'ServerStorage'],
      ['StarterGui', 'StarterGui'],
      ['StarterPack', 'StarterPack'],
      ['StarterPlayer', 'StarterPlayer'],
      ['Teams', 'Teams'],
      ['SoundService', 'SoundService'],
      ['Chat', 'Chat'],
    ]),
  ],
  // RunService events - common patterns
  [
    'RunService',
    new Map([
      ['Heartbeat', 'RBXScriptSignal'],
      ['RenderStepped', 'RBXScriptSignal'],
      ['Stepped', 'RBXScriptSignal'],
      ['PreRender', 'RBXScriptSignal'],
      ['PreSimulation', 'RBXScriptSignal'],
      ['PostSimulation', 'RBXScriptSignal'],
    ]),
  ],
  // UserInputService common children
  [
    'UserInputService',
    new Map([
      ['InputBegan', 'RBXScriptSignal'],
      ['InputEnded', 'RBXScriptSignal'],
      ['InputChanged', 'RBXScriptSignal'],
    ]),
  ],
  // Character model specifics (common R6/R15 parts)
  [
    'CharacterModel',
    new Map([
      ['Humanoid', 'Humanoid'],
      ['HumanoidRootPart', 'Part'],
      ['Head', 'Part'],
      ['Torso', 'Part'],
      ['UpperTorso', 'MeshPart'],
      ['LowerTorso', 'MeshPart'],
      ['LeftArm', 'Part'],
      ['RightArm', 'Part'],
      ['LeftLeg', 'Part'],
      ['RightLeg', 'Part'],
      ['LeftHand', 'MeshPart'],
      ['RightHand', 'MeshPart'],
      ['LeftFoot', 'MeshPart'],
      ['RightFoot', 'MeshPart'],
      ['LeftUpperArm', 'MeshPart'],
      ['RightUpperArm', 'MeshPart'],
      ['LeftLowerArm', 'MeshPart'],
      ['RightLowerArm', 'MeshPart'],
      ['LeftUpperLeg', 'MeshPart'],
      ['RightUpperLeg', 'MeshPart'],
      ['LeftLowerLeg', 'MeshPart'],
      ['RightLowerLeg', 'MeshPart'],
    ]),
  ],
]);

/**
 * Looks up a common child type for a given parent class and child name.
 *
 * This function traverses the inheritance chain to find the expected type of a child
 * instance. If the parent class itself does not have a mapping for the child name,
 * the function will check the parent's superclass, and so on up the hierarchy.
 *
 * @param parentClassName - The class name of the parent instance (e.g., 'Model', 'Player')
 * @param childName - The name of the child being accessed (e.g., 'Humanoid', 'Character')
 * @param getSuperclass - Optional function to resolve the superclass of a given class name.
 *                        If not provided, only the direct parent class mapping is checked.
 * @returns The expected child type as a string, or undefined if no mapping exists
 *
 * @example
 * ```typescript
 * const type = getCommonChildType('Model', 'Humanoid'); // 'Humanoid'
 * const type2 = getCommonChildType('Player', 'Character'); // 'Model'
 * const type3 = getCommonChildType('Model', 'Unknown'); // undefined
 * ```
 */
export const getCommonChildType = (
  parentClassName: string,
  childName: string,
  getSuperclass?: (className: string) => string | undefined,
): string | undefined => {
  let currentClass: string | undefined = parentClassName;

  while (currentClass !== undefined) {
    const children = COMMON_CHILDREN.get(currentClass);
    if (children !== undefined) {
      const childType = children.get(childName);
      if (childType !== undefined) return childType;
    }

    if (getSuperclass === undefined) break;
    currentClass = getSuperclass(currentClass);
  }

  return undefined;
};
