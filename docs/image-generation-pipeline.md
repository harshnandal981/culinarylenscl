# Image Generation Pipeline - Fault Tolerance Documentation

## Overview
This document describes the fault-tolerant image generation pipeline implemented to prevent image generation failures from affecting the app's connectivity state or navigation.

## Problem Statement
Previously, when image generation failed via Gemini's image generation API:
- The `withRetry` function would set `sessionForceOffline = true` on quota errors
- This caused `checkOnlineStatus()` to return `false`
- The app would incorrectly enter Sovereign/Offline mode
- Navigation and global UI elements would be disabled
- Users experienced broken functionality

## Solution Architecture

### 1. Isolated Image Generation Retry Logic

**Implementation**: `withImageRetry` function in `services/geminiService.ts`

```typescript
const withImageRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    const errorMsg = err?.message || '';
    const isTransient = errorMsg.includes('500') || errorMsg.includes('fetch') || errorMsg.includes('timeout');

    if (isTransient && retries > 0) {
      console.warn(`[Image Generation] Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withImageRetry(fn, retries - 1, delay * 1.5);
    }
    throw err;
  }
};
```

**Key Features**:
- Does NOT modify `sessionForceOffline` state
- Only retries on transient errors (500, fetch, timeout)
- Shorter retry cycle (2 attempts vs 3)
- Faster initial delay (1s vs 2s)

### 2. Visual Blueprint Fallback System

**Implementation**: `generateVisualBlueprint` function

When image generation fails, the system automatically requests a high-fidelity text description from Gemini:

```typescript
export interface VisualBlueprint {
  plating: string;
  colors: string;
  textures: string;
  garnish: string;
  lighting: string;
  composition: string;
}
```

**Rendering**: Visual blueprints are displayed as styled cards with detailed descriptions organized by category (plating, colors, textures, composition).

### 3. Progressive UX in Synthesis Component

**Non-Blocking Image Generation**:
```typescript
try {
  const v = await generatePlatingVisual(generatedProtocol);
  if (v) {
    setVisualUrl(v);
  } else {
    const blueprint = await generateVisualBlueprint(generatedProtocol.title, generatedProtocol.description);
    setVisualBlueprint(blueprint);
  }
} catch (imgErr) {
  console.warn('[Synthesis] Plating visual failed, using blueprint fallback:', imgErr);
  const blueprint = await generateVisualBlueprint(generatedProtocol.title, generatedProtocol.description);
  setVisualBlueprint(blueprint);
}
```

**Key Features**:
- Each image generation is independently wrapped in try-catch
- Failures don't propagate to parent error handler
- Navigation remains fully functional
- Progress continues to completion regardless of image failures

### 4. Debug Telemetry

**Mode Change Logging**:
```typescript
const logModeChange = (source: string, reason: string, newState: boolean) => {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    console.warn("SYSTEM MODE CHANGE", {
      source,
      reason,
      newState: newState ? 'OFFLINE' : 'ONLINE',
      stack: new Error().stack
    });
  }
};
```

**Header Component Monitoring**:
- Logs all status changes in development mode
- Tracks browser-level network events separately
- Provides clear visibility into mode transitions

## API Functions Updated

### Image Generation Functions (Non-Authoritative)
All now use `withImageRetry` and include warning logs:
- `generatePlatingVisual(protocol: NeuralProtocol): Promise<string>`
- `generateDrinkVisual(drinkName: string): Promise<string>`
- `generateIngredientVisual(ingredientName: string): Promise<string>`
- `generateSchematic(protocol: NeuralProtocol): Promise<string>`

### New Functions
- `generateVisualBlueprint(dishName: string, description: string): Promise<VisualBlueprint | null>`
  - Generates fallback text descriptions
  - Returns structured visual details
  - Has its own offline fallback with sensible defaults

## Safety Rules Enforced

### Image Rendering
✅ **SAFE**:
- `<img src={base64Image} alt="..." />`
- `URL.createObjectURL(blob)` inside `<img />`

❌ **UNSAFE** (Prevented):
- `window.location = image`
- `<a href={image}>` (when image is dynamic data)

### Offline Mode Triggers
✅ **AUTHORIZED**:
- Browser `offline` event
- Browser `online` event
- `navigator.onLine` state
- Quota exceeded on **critical operations** (recipe synthesis, manifest alignment)

❌ **BLOCKED**:
- Image generation failures
- Image generation quota errors
- Transient image API errors

## Testing Scenarios

### 1. Image Generation Success
- All images load normally
- No blueprint fallback shown
- System stays in Neural Link mode

### 2. Image Generation Failure (Network)
- Images fail to load
- Visual blueprint is automatically generated
- Navigation remains enabled
- System stays in Neural Link mode
- Only console warnings appear

### 3. Image Generation Failure (Quota)
- Images return empty strings
- Visual blueprint fallback activates
- System does NOT enter offline mode
- Recipe synthesis continues to work
- User can still use all features

### 4. Actual Network Offline
- Browser `offline` event fires
- System enters Edge Mode correctly
- All features continue with offline protocols
- Visual blueprints use offline defaults

## Migration Notes

**Before**:
- Image generation used `withRetry` (critical operation retry)
- Failures could set `sessionForceOffline = true`
- No fallback mechanism

**After**:
- Image generation uses `withImageRetry` (isolated retry)
- Failures never affect system connectivity state
- Automatic fallback to visual blueprints
- Progressive UX with independent error handling

## Monitoring & Debugging

Check browser console for:
- `[Image Generation]` prefix: Image-specific operations
- `SYSTEM MODE CHANGE`: System connectivity transitions
- `UI MODE INDICATOR CHANGE`: Header status display changes
- `[Network Event]`: Browser-level connectivity events

## Future Enhancements

1. **Caching**: Cache generated images in IndexedDB
2. **Retry Strategy**: Implement exponential backoff with jitter
3. **Quality Levels**: Try lower quality images before fallback
4. **Partial Loading**: Show progressive image loading states
5. **User Preference**: Allow users to disable image generation entirely
