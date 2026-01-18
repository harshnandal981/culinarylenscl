# Testing Guide: Image Generation Pipeline

## Manual Testing Scenarios

### Scenario 1: Normal Operation (Happy Path)
**Objective**: Verify images load correctly when API is working

**Steps**:
1. Start the app with valid Gemini API key
2. Navigate through: Landing → Upload → Analysis → Dashboard
3. Click "Synthesize" and select a cuisine
4. Click "Synthesize" button
5. Wait for synthesis to complete

**Expected Results**:
- ✅ Plating image loads and displays
- ✅ Drink pairing image loads (small thumbnail)
- ✅ Schematic image loads
- ✅ Header shows "Neural Link Online"
- ✅ Navigation remains enabled throughout
- ✅ No console errors
- ✅ Smooth progression through all synthesis steps

### Scenario 2: Image Generation Failure (Network Error)
**Objective**: Verify graceful degradation when images fail to generate

**Steps**:
1. Simulate network issues or API timeout
2. Follow steps 1-5 from Scenario 1
3. Monitor console output
4. Check visual blueprint display

**Expected Results**:
- ✅ Visual blueprint card displays instead of image
- ✅ Blueprint shows structured visual description (plating, colors, textures, composition)
- ✅ Header STILL shows "Neural Link Online" (not Edge Mode)
- ✅ Navigation remains fully enabled
- ✅ Console shows `[Image Generation]` warnings (not errors)
- ✅ Recipe protocol loads successfully
- ✅ Can click "Execute" button
- ✅ No app crash or freeze

**Console Output Expected**:
```
[Image Generation] Plating visual failed, using blueprint fallback: [error details]
```

### Scenario 3: Quota Exceeded on Images Only
**Objective**: Verify quota errors on images don't affect system

**Steps**:
1. Use API key with limited quota
2. Trigger multiple synthesis operations to exhaust quota
3. Attempt synthesis when quota is low
4. Monitor system behavior

**Expected Results**:
- ✅ Image generation returns empty strings
- ✅ Visual blueprints automatically activate
- ✅ System does NOT enter "Edge Mode"
- ✅ Recipe synthesis continues to work
- ✅ No `sessionForceOffline` flag set
- ✅ Can synthesize multiple recipes
- ✅ Navigation never disabled

**Console Output Should NOT Show**:
```
❌ "SYSTEM MODE CHANGE" with reason "Quota exceeded"
```

**Console Output SHOULD Show**:
```
✅ [Image Generation] Plating visual failed: [quota error]
```

### Scenario 4: Real Network Offline
**Objective**: Verify legitimate offline mode still works

**Steps**:
1. Disconnect from internet (browser offline)
2. Or simulate via DevTools: Network tab → "Offline"
3. Observe Header status
4. Try to synthesize

**Expected Results**:
- ✅ Header changes to "Edge Mode"
- ✅ Console shows `[Network Event] Browser detected offline`
- ✅ Console shows `SYSTEM MODE CHANGE` with source "Browser offline event"
- ✅ App switches to offline protocol synthesis
- ✅ Visual blueprints use offline defaults
- ✅ No API calls attempted

**Console Output Expected**:
```
[Network Event] Browser detected offline
SYSTEM MODE CHANGE {
  source: "checkOnlineStatus",
  reason: "Browser-level offline",
  newState: "OFFLINE"
}
```

### Scenario 5: Mixed Success/Failure
**Objective**: Verify individual image failures don't affect other images

**Steps**:
1. Synthesize a recipe
2. Observe which images load and which don't
3. Check that partial success is handled

**Expected Results**:
- ✅ Successfully loaded images display normally
- ✅ Failed images show blueprint or placeholder
- ✅ UI remains consistent and usable
- ✅ No cascading failures
- ✅ Can still execute recipe

## Automated Testing Checklist

### Build & Compile
```bash
npm run build
```
**Expected**: ✅ No TypeScript errors, successful build

### Code Quality
```bash
npm run dev
```
**Expected**: ✅ Dev server starts, no console errors

### Safety Checks

#### Image Rendering Pattern Check
```bash
grep -r "window.location.*=.*image" .
grep -r "<a.*href.*visual" .
```
**Expected**: ✅ No matches (safe patterns only)

#### Offline Mode Isolation Check
Search for `sessionForceOffline = true` calls:
```bash
grep -n "sessionForceOffline = true" services/geminiService.ts
```
**Expected**: ✅ Only in `withRetry` function (critical operations only)

## Browser DevTools Testing

### Network Tab Simulation
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Try image generation
4. Verify progressive loading and fallback

### Console Monitoring
Enable all log levels and verify:
- ✅ `[Image Generation]` warnings appear for failures
- ✅ `SYSTEM MODE CHANGE` only appears for real network events
- ✅ No uncaught exceptions
- ✅ No infinite retry loops

### Application Tab
Check IndexedDB/LocalStorage:
- ✅ API key stored correctly
- ✅ User preferences saved
- ✅ No image data in storage (images are transient)

## Performance Testing

### Memory Leaks
1. Generate 5-10 recipes in sequence
2. Monitor Chrome Task Manager
3. Check for memory growth

**Expected**: ✅ No significant memory leaks

### Image Loading Time
**Acceptable**: < 10 seconds per image
**Fallback Trigger**: After 3 retry attempts with exponential backoff

## Regression Testing

Verify these features still work:
- ✅ API key configuration in Settings
- ✅ Ingredient analysis and recognition
- ✅ Recipe protocol synthesis
- ✅ Execution mode with step-by-step guidance
- ✅ Dietary preferences and allergies
- ✅ Cuisine selection
- ✅ Drink pairing suggestions

## Edge Cases

### Empty API Response
**Trigger**: API returns 200 but empty image data
**Expected**: Visual blueprint fallback

### Malformed API Response
**Trigger**: API returns invalid base64 data
**Expected**: Try-catch handles gracefully, shows blueprint

### Rapid Successive Calls
**Trigger**: User clicks synthesize multiple times quickly
**Expected**: Requests queued or deduplicated, no crashes

### Large Images
**Trigger**: API returns very large base64 images
**Expected**: Images render correctly, no memory issues

## Documentation Verification

Ensure updated:
- ✅ `docs/image-generation-pipeline.md` exists
- ✅ Code comments accurate
- ✅ README reflects new behavior (if applicable)

## Deployment Verification (Vercel)

After deployment:
1. Test on production URL
2. Verify Vercel environment variables set
3. Check production console for unexpected errors
4. Test with real Gemini API
5. Verify all images load or fallback appropriately

## Success Criteria

The implementation is successful when:
- ✅ Image generation failures never trigger offline mode
- ✅ Navigation always remains enabled
- ✅ Visual blueprints provide meaningful fallback
- ✅ System connectivity reflects only real network state
- ✅ Debug logging provides clear visibility
- ✅ No security vulnerabilities introduced
- ✅ Build passes cleanly
- ✅ Code review passes
- ✅ CodeQL security scan passes
- ✅ User experience remains smooth regardless of image API status
