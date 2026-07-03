# Stash Plugins

## Installation

https://haraldan.github.io/stash-plugins/main/index.yml

## Plugin List

### Stash Scenes and Markers

Adds a **Scenes+** page (in the main nav) that shows scenes and scene markers together in one unified card grid. Useful if you use markers as ranges inside multi-scene videos, since they then serve the same purpose as scenes.

- Shared tag filter and free-text search across both scenes and markers
- Sort by date, created, or title (markers sort by their parent scene's date)
- "Hide scenes with markers" toggle (default on) so markers replace their parent scene
- Marker cards open the scene seeked to the marker's start time
- Reuses Stash's own scene/marker cards, with a plain-card fallback

Built with esbuild from `plugins/stashScenesAndMarkers/src/main.tsx`; the committed `stashScenesAndMarkers.js` is the built bundle (run `npm install && npm run build` in that folder after editing the source).

### Stash Performer Markers Tab

Adds a Markers link to performer pages

![Performer page](images/Stash%20Performer%20Markers%20Tab/performer-page.png?raw=true "Performer page")
