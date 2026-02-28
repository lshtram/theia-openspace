# Voice: Emoji Stripping + Theia Settings Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip emojis from TTS narration text, and expose all voice policy fields as native Theia preferences so users can change them via `File > Preferences > Settings` without going through the wizard.

**Architecture:** Two independent changes. (1) One regex in `cleanTextForTts` strips emoji before text reaches the TTS backend. (2) A new `VoicePreferenceSchema` contribution registers settings with Theia's preference system; `VoiceCommandContribution.onStart()` seeds `SessionFsm` from those preferences, and every `updatePolicy()` call writes back so the wizard and Settings panel stay in sync.

**Tech Stack:** TypeScript, Theia `PreferenceContribution` / `PreferenceService`, Mocha/Chai tests, webpack (browser bundle).

---

## Task 1: Emoji stripping in `cleanTextForTts`

**Files:**
- Modify: `extensions/openspace-voice/src/common/text-cleanup.ts`
- Test: `extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts`

### Step 1: Write the failing test

Add at the bottom of `text-cleanup.spec.ts` (before the closing `}`):

```typescript
it('strips emoji characters', () => {
  assert.equal(cleanTextForTts('Great work! 🎉 Let me check 🚀'), 'Great work! Let me check');
});

it('strips emoji with surrounding text intact', () => {
  assert.equal(cleanTextForTts('Hello 👋 world'), 'Hello world');
});
```

### Step 2: Run test to verify it fails

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | grep -A3 "strips emoji"
```

Expected: `AssertionError` — emoji not stripped yet.

### Step 3: Add emoji stripping to `cleanTextForTts`

In `text-cleanup.ts`, add after the bullet marker strip and before the whitespace collapse (after line 31, before line 33):

```typescript
  // Strip emoji (Unicode emoji presentation + extended pictographic + variation selectors)
  result = result.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
```

### Step 4: Run tests to verify they pass

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | tail -10
```

Expected: all passing, 0 failures.

### Step 5: Commit

```bash
git add extensions/openspace-voice/src/common/text-cleanup.ts \
        extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts
git commit -m "feat(voice): strip emoji from TTS narration text"
```

---

## Task 2: Voice preference schema declaration

**Files:**
- Create: `extensions/openspace-voice/src/browser/voice-preferences.ts`

No test required (pure constant declarations — covered implicitly by Task 3's integration test).

### Step 1: Create `voice-preferences.ts`

```typescript
// extensions/openspace-voice/src/browser/voice-preferences.ts
import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';
import { SUPPORTED_VOICES } from '../common/voice-policy';

export const VoicePreferenceKeys = {
  ENABLED:              'openspace.voice.enabled'            as const,
  NARRATION_MODE:       'openspace.voice.narrationMode'      as const,
  VOICE:                'openspace.voice.voice'              as const,
  SPEED:                'openspace.voice.speed'              as const,
  LANGUAGE:             'openspace.voice.language'           as const,
  AUTO_DETECT_LANGUAGE: 'openspace.voice.autoDetectLanguage' as const,
};

export const VoicePreferenceSchema: PreferenceSchema = {
  properties: {
    [VoicePreferenceKeys.ENABLED]: {
      type: 'boolean',
      default: true,
      description: 'Enable voice input and narration.',
    },
    [VoicePreferenceKeys.NARRATION_MODE]: {
      type: 'string',
      enum: ['narrate-off', 'narrate-everything', 'narrate-summary'],
      default: 'narrate-everything',
      description: 'How assistant replies are narrated. "narrate-off" disables narration; "narrate-everything" reads replies in full; "narrate-summary" speaks a one-sentence summary.',
    },
    [VoicePreferenceKeys.VOICE]: {
      type: 'string',
      enum: [...SUPPORTED_VOICES],
      default: 'af_sarah',
      description: 'Kokoro TTS voice ID.',
    },
    [VoicePreferenceKeys.SPEED]: {
      type: 'number',
      default: 1.0,
      minimum: 0.5,
      maximum: 2.0,
      description: 'TTS playback speed (0.5 – 2.0).',
    },
    [VoicePreferenceKeys.LANGUAGE]: {
      type: 'string',
      default: 'en-US',
      description: 'BCP-47 language code for speech recognition (e.g. "en-US", "fr-FR").',
    },
    [VoicePreferenceKeys.AUTO_DETECT_LANGUAGE]: {
      type: 'boolean',
      default: false,
      description: 'When enabled, Whisper automatically detects the spoken language.',
    },
  },
};
```

### Step 2: Verify file was created

```bash
ls extensions/openspace-voice/src/browser/voice-preferences.ts
```

Expected: file exists (no error).

### Step 3: Commit

```bash
git add extensions/openspace-voice/src/browser/voice-preferences.ts
git commit -m "feat(voice): add VoicePreferenceSchema for Theia settings integration"
```

---

## Task 3: Bind PreferenceContribution in the DI module

**Files:**
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`

### Step 1: Add the import and binding

At the top of `openspace-voice-frontend-module.ts`, add two imports:

```typescript
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { VoicePreferenceSchema } from './voice-preferences';
```

Inside the `ContainerModule` callback, add before the existing `bind(SessionFsm)` line:

```typescript
  bind(PreferenceContribution).toConstantValue({ schema: VoicePreferenceSchema });
```

### Step 2: Build the extension to check for TypeScript errors

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -20
```

Expected: exits 0, no TypeScript errors.

### Step 3: Commit

```bash
git add extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
git commit -m "feat(voice): register VoicePreferenceSchema as Theia PreferenceContribution"
```

---

## Task 4: Seed SessionFsm from preferences on startup + sync back on every policy change

**Files:**
- Modify: `extensions/openspace-voice/src/browser/voice-command-contribution.ts`

The `VoiceCommandContribution` is already `@injectable()` and has `onStart()`. We add `@inject(PreferenceService)` to read current values at startup and subscribe to changes. We also update `updatePolicy()` calls (wizard finish + MCP path) so they write back to preferences.

### Step 1: Add imports at the top of `voice-command-contribution.ts`

```typescript
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { VoicePreferenceKeys } from './voice-preferences';
```

### Step 2: Add the `@inject` field (alongside existing injected fields)

```typescript
  @inject(PreferenceService) private readonly preferenceService!: PreferenceService;
```

### Step 3: Add helper method to read current policy from preferences

Add a private method at the bottom of the class (before the closing `}`):

```typescript
  /** Read voice policy fields from Theia preferences. Returns a Partial<VoicePolicy>. */
  private policyFromPreferences(): Partial<import('../common/voice-policy').VoicePolicy> {
    return {
      enabled:              this.preferenceService.get<boolean>(VoicePreferenceKeys.ENABLED, true),
      narrationMode:        this.preferenceService.get<string>(VoicePreferenceKeys.NARRATION_MODE, 'narrate-everything') as import('../common/voice-policy').NarrationMode,
      voice:                this.preferenceService.get<string>(VoicePreferenceKeys.VOICE, 'af_sarah'),
      speed:                this.preferenceService.get<number>(VoicePreferenceKeys.SPEED, 1.0),
      language:             this.preferenceService.get<string>(VoicePreferenceKeys.LANGUAGE, 'en-US'),
      autoDetectLanguage:   this.preferenceService.get<boolean>(VoicePreferenceKeys.AUTO_DETECT_LANGUAGE, false),
    };
  }

  /** Write current policy fields back to Theia preferences. */
  private async persistPolicyToPreferences(policy: Partial<import('../common/voice-policy').VoicePolicy>): Promise<void> {
    const updates: Array<Promise<void>> = [];
    if (policy.enabled !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.ENABLED, policy.enabled, undefined));
    if (policy.narrationMode !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.NARRATION_MODE, policy.narrationMode, undefined));
    if (policy.voice !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.VOICE, policy.voice, undefined));
    if (policy.speed !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.SPEED, policy.speed, undefined));
    if (policy.language !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.LANGUAGE, policy.language, undefined));
    if (policy.autoDetectLanguage !== undefined)
      updates.push(this.preferenceService.set(VoicePreferenceKeys.AUTO_DETECT_LANGUAGE, policy.autoDetectLanguage, undefined));
    await Promise.all(updates);
  }
```

### Step 4: Update `onStart()` to seed from preferences and subscribe to changes

Replace the existing `onStart()` body:

```typescript
  onStart(): void {
    // Seed policy from stored preferences
    const stored = this.policyFromPreferences();
    this.sessionFsm.updatePolicy(stored);

    // Sync FSM enabled/inactive state
    if (stored.enabled && this.sessionFsm.state === 'inactive') {
      this.sessionFsm.enable();
    } else if (!stored.enabled && this.sessionFsm.state !== 'inactive') {
      this.sessionFsm.disable();
    }

    // React to future Settings panel changes in real-time
    this.preferenceService.onPreferenceChanged(change => {
      if (!change.preferenceName.startsWith('openspace.voice.')) return;
      const updated = this.policyFromPreferences();
      this.sessionFsm.updatePolicy(updated);
      if (updated.enabled && this.sessionFsm.state === 'inactive') {
        this.sessionFsm.enable();
      } else if (!updated.enabled && this.sessionFsm.state !== 'inactive') {
        this.sessionFsm.disable();
      }
      this.updateStatusBar();
    });

    this.updateStatusBar();
    this.waveformOverlay.setOnCancel(() => this.narrationFsm.stop());
  }
```

### Step 5: Persist after the wizard finishes

In `showPolicyWizard()`, replace the `this.sessionFsm.updatePolicy({...})` block at the end (around line 300) with:

```typescript
    const newPolicy = {
      enabled:            enabledChoice.value,
      narrationMode:      modeChoice.value as typeof NARRATION_MODES[number],
      speed:              speedChoice.value,
      voice:              voiceChoice.value,
      language:           selectedLanguage,
      autoDetectLanguage: autoDetectChoice.value,
    };
    this.sessionFsm.updatePolicy(newPolicy);
    // Persist to Theia preferences so Settings panel stays in sync
    this.persistPolicyToPreferences(newPolicy).catch(err =>
      console.warn('[Voice] Failed to persist policy to preferences:', err)
    );

    // Sync FSM state to enabled flag
    if (enabledChoice.value && this.sessionFsm.state === 'inactive') {
      this.sessionFsm.enable();
    } else if (!enabledChoice.value && this.sessionFsm.state !== 'inactive') {
      this.sessionFsm.disable();
    }
```

### Step 6: Persist when SET_POLICY is called programmatically (MCP path)

In the `SET_POLICY` execute handler, replace:

```typescript
        if (args && Object.keys(args).length > 0) {
          this.sessionFsm.updatePolicy(args);
          return;
        }
```

With:

```typescript
        if (args && Object.keys(args).length > 0) {
          this.sessionFsm.updatePolicy(args);
          this.persistPolicyToPreferences(args).catch(err =>
            console.warn('[Voice] Failed to persist policy to preferences:', err)
          );
          return;
        }
```

### Step 7: Build to verify TypeScript

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -20
```

Expected: exits 0.

### Step 8: Commit

```bash
git add extensions/openspace-voice/src/browser/voice-command-contribution.ts
git commit -m "feat(voice): seed and sync voice policy with Theia preferences"
```

---

## Task 5: Webpack rebuild + verify

**Files:**
- Read-only verification only

### Step 1: Rebuild webpack bundle

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development 2>&1 | tail -10
```

Expected: `webpack 5.x.x compiled successfully`.

### Step 2: Verify new code is in the bundle

```bash
rg "openspace.voice.narrationMode" browser-app/lib/frontend/
```

Expected: at least one match in a chunk file.

### Step 3: Verify emoji regex is in the bundle

```bash
rg "Emoji_Presentation" browser-app/lib/frontend/
```

Expected: at least one match.

### Step 4: Run the voice unit tests

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | tail -10
```

Expected: all passing, 0 failures.

### Step 5: Hard-refresh browser and open Settings

In the browser at `http://localhost:3000`, press `Cmd+Shift+R`, then open `File > Preferences > Settings` and search for `voice`. Verify the six `openspace.voice.*` entries appear.

---

## Acceptance Criteria

- [ ] `cleanTextForTts('Hello 👋 world')` → `'Hello world'`
- [ ] All existing `text-cleanup` tests still pass
- [ ] `File > Preferences > Settings` shows `openspace.voice.enabled`, `.narrationMode`, `.voice`, `.speed`, `.language`, `.autoDetectLanguage`
- [ ] Changing a value in Settings updates narration behaviour without opening the wizard
- [ ] Running the wizard persists its result back to Settings
- [ ] MCP `set_policy` tool call also persists to Settings
- [ ] Voice extension builds with 0 TypeScript errors
- [ ] Webpack bundle contains new preference key strings
