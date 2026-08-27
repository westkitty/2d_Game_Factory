import { puzzleArcadeStarterKit } from './builders/puzzleArcade.ts';
import { withDefaultThemeRoles } from './builders/themeRoles.ts';

export const starterKit = withDefaultThemeRoles(puzzleArcadeStarterKit('pong'), ['ui.panel']);
