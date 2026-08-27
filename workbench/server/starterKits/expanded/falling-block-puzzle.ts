import { puzzleArcadeStarterKit } from './builders/puzzleArcade.ts';
import { withDefaultThemeRoles } from './builders/themeRoles.ts';

export const starterKit = withDefaultThemeRoles(puzzleArcadeStarterKit('falling-block-puzzle'), ['ui.panel']);
