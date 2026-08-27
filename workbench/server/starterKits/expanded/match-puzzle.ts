import { puzzleArcadeStarterKit } from './builders/puzzleArcade.ts';
import { withDefaultThemeRoles } from './builders/themeRoles.ts';

export const starterKit = withDefaultThemeRoles(puzzleArcadeStarterKit('match-puzzle'), ['ui.panel', 'ui.cursor']);
