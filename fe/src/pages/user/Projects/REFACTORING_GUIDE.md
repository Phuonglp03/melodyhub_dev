# ProjectDetailPage.js Refactoring Guide

## Overview

This document outlines the step-by-step process to refactor `ProjectDetailPage.js` from a monolithic 5,937-line component into a clean, modular structure using extracted hooks and components.

## Current State

- **File**: `fe/src/pages/user/Projects/ProjectDetailPage.js`
- **Size**: 5,937 lines
- **Status**: Contains all logic inline

## Target State

- **File**: `fe/src/pages/user/Projects/ProjectDetailPage.js`
- **Target Size**: ~200-300 lines (main orchestrator)
- **Structure**: Uses extracted hooks and components

## Extracted Components & Hooks

### Hooks (in `fe/src/hooks/`)
1. `useProjectTimeline.js` - Timeline state and operations
2. `useProjectChords.js` - Chord progression and library
3. `useProjectLicks.js` - Lick library and search
4. `useProjectSettings.js` - Project settings management
5. `useProjectHistory.js` - Undo/redo functionality

### Components (in `fe/src/components/`)

#### Timeline Components
- `ProjectTimeline/TimelineView.js` - Main timeline container
- `ProjectTimeline/TimelineTrack.js` - Individual track row
- `ProjectTimeline/TimelineClip.js` - Individual clip
- `ProjectTimeline/WaveformRenderer.js` - Waveform visualization
- `ProjectTimeline/TrackDropZone.js` - Drag-and-drop zone

#### Settings Components
- `ProjectSettings/ProjectSettingsPanel.js` - Settings panel wrapper
- `ProjectSettings/TempoControl.js` - Tempo input
- `ProjectSettings/KeySignatureControl.js` - Key selector
- `ProjectSettings/TimeSignatureControl.js` - Time signature selector

#### Collaboration Components
- `Collaboration/CollaborationPanel.js` - Collaborator panel
- `Collaboration/ActiveEditorsIndicator.js` - Active editor indicator

#### Chord Components
- `ChordProgression/ChordProgressionEditor.js` - Chord progression editor
- `ChordProgression/ChordLibrary.js` - Chord library

#### Audio Components
- `AudioControls/ProjectPlaybackControls.js` - Playback controls with metronome

### Utilities (in `fe/src/utils/`)
- `projectHelpers.js` - Music theory, chord normalization, formatting
- `timelineHelpers.js` - Timeline utilities, MIDI events, rhythm patterns

## Refactoring Steps

### Phase 1: Update Imports

1. **Remove old utility imports** (lines ~1-150)
   - Remove inline utility functions
   - Add imports from `utils/projectHelpers` and `utils/timelineHelpers`

2. **Add hook imports**
   ```javascript
   import { useProjectTimeline } from "../../../hooks/useProjectTimeline";
   import { useProjectChords } from "../../../hooks/useProjectChords";
   import { useProjectLicks } from "../../../hooks/useProjectLicks";
   import { useProjectSettings } from "../../../hooks/useProjectSettings";
   import { useProjectHistory } from "../../../hooks/useProjectHistory";
   ```

3. **Add component imports**
   ```javascript
   import TimelineView from "../../../components/ProjectTimeline/TimelineView";
   import ProjectSettingsPanel from "../../../components/ProjectSettings/ProjectSettingsPanel";
   import CollaborationPanel from "../../../components/Collaboration/CollaborationPanel";
   import ChordProgressionEditor from "../../../components/ChordProgression/ChordProgressionEditor";
   import ChordLibrary from "../../../components/ChordProgression/ChordLibrary";
   import ProjectPlaybackControls from "../../../components/AudioControls/ProjectPlaybackControls";
   ```

### Phase 2: Replace State Management with Hooks

1. **Replace timeline state** (lines ~1630-1850)
   - Remove: `tracks`, `setTracks`, `zoomLevel`, `selectedItem`, etc.
   - Use: `useProjectTimeline()` hook
   - Pass required dependencies: `projectId`, `projectTempo`, `projectTimeSignature`, etc.

2. **Replace chord state** (lines ~1850-2000)
   - Remove: `chordProgression`, `setChordProgression`, `chordLibrary`, etc.
   - Use: `useProjectChords()` hook
   - Pass dependencies from `useProjectTimeline` and `useProjectSettings`

3. **Replace lick state** (lines ~2000-2200)
   - Remove: `availableLicks`, `lickSearchTerm`, `selectedGenre`, etc.
   - Use: `useProjectLicks()` hook

4. **Replace settings state** (lines ~1500-1650)
   - Remove: `tempoDraft`, `instruments`, `rhythmPatterns`, etc.
   - Use: `useProjectSettings()` hook

5. **Replace history state** (lines ~2200-2300)
   - Remove: `historyRef`, `futureRef`, `historyStatus`
   - Use: `useProjectHistory()` hook
   - Pass `tracks`, `chordProgression` from hooks

### Phase 3: Replace Inline Functions

1. **Remove utility functions** (lines ~145-900)
   - All functions moved to `utils/projectHelpers.js` and `utils/timelineHelpers.js`
   - Update any remaining references to use imported functions

2. **Remove timeline functions** (lines ~2800-3500)
   - Functions like `handleClipMove`, `handleClipResize`, `handleDrop` are in `useProjectTimeline`
   - Functions like `handleAddChord`, `handleChordSelect` are in `useProjectChords`
   - Functions like `fetchLicks`, `handleLickPlayPause` are in `useProjectLicks`

3. **Remove settings functions** (lines ~3200-3400)
   - `commitTempoChange`, `handleKeyChange`, `handleTimeSignatureChange` are in `useProjectSettings`

### Phase 4: Replace JSX with Components

1. **Replace Timeline JSX** (lines ~4700-5600)
   - Replace entire timeline rendering with `<TimelineView />`
   - Pass all required props from hooks

2. **Replace Settings JSX** (lines ~4550-4600)
   - Replace tempo/key/time signature controls with `<ProjectSettingsPanel />`

3. **Replace Collaboration JSX** (lines ~4400-4450)
   - Replace collaborator avatars and invite button with `<CollaborationPanel />`

4. **Replace Chord Progression JSX** (lines ~4790-4856)
   - Replace chord progression rendering with `<ChordProgressionEditor />`

5. **Replace Audio Controls JSX** (lines ~4546-4556)
   - Replace `AudioTransportControls` usage with `<ProjectPlaybackControls />`

### Phase 5: Clean Up

1. **Remove unused imports**
   - Remove imports for components/functions that are now in hooks/components

2. **Remove unused constants**
   - Constants moved to `utils/projectHelpers.js` (e.g., `TIME_SIGNATURES`, `KEY_OPTIONS`)

3. **Remove inline components**
   - Remove `TrackDropZone` component definition (now in `components/ProjectTimeline/`)

4. **Update event handlers**
   - Ensure all event handlers use functions from hooks
   - Update prop passing to match hook interfaces

## Key Dependencies Between Hooks

```
useProjectSettings
  └─> provides: bpm, projectKeyName, projectTimeSignatureName
  
useProjectTimeline (depends on useProjectSettings)
  └─> provides: tracks, setTracks, pixelsPerBeat, secondsPerBeat, etc.
  
useProjectChords (depends on useProjectTimeline, useProjectSettings)
  └─> provides: chordProgression, setChordProgression, chordItems, etc.
  
useProjectHistory (depends on useProjectTimeline, useProjectChords)
  └─> provides: pushHistory, handleUndo, handleRedo
  
useProjectLicks (independent)
  └─> provides: availableLicks, fetchLicks, handleDragStart, etc.
```

## Props Mapping

### TimelineView Props
```javascript
<TimelineView
  tracks={tracks}
  chordProgression={chordProgression}
  pixelsPerSecond={pixelsPerSecond}
  pixelsPerBeat={pixelsPerBeat}
  secondsPerBeat={secondsPerBeat}
  beatsPerMeasure={beatsPerMeasure}
  timelineWidth={timelineWidth}
  playbackPosition={playbackPosition}
  isPlaying={isPlaying}
  chordDurationSeconds={chordDurationSeconds}
  selectedChordIndex={selectedChordIndex}
  collaborators={collaborators}
  broadcastCursor={broadcastCursor}
  timelineRef={timelineRef}
  playheadRef={playheadRef}
  clipRefs={clipRefs}
  // ... all other track props
/>
```

### ProjectSettingsPanel Props
```javascript
<ProjectSettingsPanel
  tempoDraft={tempoDraft}
  setTempoDraft={setTempoDraft}
  onTempoCommit={commitTempoChange}
  projectKey={projectKeyName}
  onKeyChange={handleKeyChange}
  projectTimeSignature={projectTimeSignatureName}
  onTimeSignatureChange={handleTimeSignatureChange}
/>
```

### CollaborationPanel Props
```javascript
<CollaborationPanel
  collaborators={collaborators}
  currentUserId={user?._id}
  activeEditors={activeEditors}
  isConnected={isConnected}
  onInvite={() => setShowInviteModal(true)}
/>
```

## Testing Checklist

After refactoring, test the following:

- [ ] Timeline renders correctly
- [ ] Clips can be dragged and dropped
- [ ] Clips can be resized
- [ ] Playback controls work (play, pause, stop, loop)
- [ ] Metronome toggle works
- [ ] Chord progression displays and can be edited
- [ ] Chord library loads and filters correctly
- [ ] Lick library loads and can be searched
- [ ] Settings can be changed (tempo, key, time signature)
- [ ] Collaboration features work (presence, cursors)
- [ ] Undo/redo works
- [ ] Timeline autosave works
- [ ] Zoom controls work
- [ ] Track controls work (mute, solo, volume)

## Common Issues & Solutions

### Issue: Missing props
**Solution**: Check hook return values and component prop requirements

### Issue: Circular dependencies
**Solution**: Ensure hooks are called in correct order, pass dependencies explicitly

### Issue: State not updating
**Solution**: Verify state setters are from hooks, not local useState

### Issue: Functions not found
**Solution**: Import from correct hook or utility file

## Progress Tracking

- [x] Phase 1: Update Imports ✅
  - [x] Added hook imports (useProjectTimeline, useProjectChords, useProjectLicks, useProjectSettings, useProjectHistory)
  - [x] Added component imports (TimelineView, ProjectSettingsPanel, CollaborationPanel, etc.)
  - [x] Added utility imports from projectHelpers and timelineHelpers
  - [x] Removed moved constants (HISTORY_LIMIT, MIN_CLIP_DURATION, TRACK_COLOR_PALETTE, etc.)
  - [x] Removed moved utility functions (formatLabelValue, formatTrackTitle, getChordDegree, etc.)
  - [x] Removed TrackDropZone component (moved to components/ProjectTimeline/)
  - [x] Added missing function imports (normalizeRhythmPattern, hydrateChordProgression, etc.)

- [ ] Phase 2: Replace State Management
  - [ ] Replace timeline state with useProjectTimeline hook
  - [ ] Replace chord state with useProjectChords hook
  - [ ] Replace lick state with useProjectLicks hook
  - [ ] Replace settings state with useProjectSettings hook
  - [ ] Replace history state with useProjectHistory hook

- [ ] Phase 3: Replace Inline Functions
  - [ ] Remove timeline functions (now in useProjectTimeline)
  - [ ] Remove chord functions (now in useProjectChords)
  - [ ] Remove lick functions (now in useProjectLicks)
  - [ ] Remove settings functions (now in useProjectSettings)

- [ ] Phase 4: Replace JSX with Components
  - [ ] Replace timeline JSX with TimelineView component
  - [ ] Replace settings JSX with ProjectSettingsPanel component
  - [ ] Replace collaboration JSX with CollaborationPanel component
  - [ ] Replace chord progression JSX with ChordProgressionEditor component
  - [ ] Replace audio controls JSX with ProjectPlaybackControls component

- [ ] Phase 5: Clean Up
  - [ ] Remove unused imports
  - [ ] Remove unused constants
  - [ ] Update event handlers
  - [ ] Final code review

- [ ] Testing

## Notes

- Keep the main component focused on orchestration
- All business logic should be in hooks
- All UI rendering should be in components
- The main component should only handle:
  - Hook initialization
  - Component composition
  - High-level event coordination
  - Collaboration setup
  - Modal management

