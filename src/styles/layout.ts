import { COLORS } from './colors';

export interface AreaTheme {
    startY: number;
    height: number;
    startX?: number;
    width?: number;
    bgColor: string;
    borderColor: string;
    borderWidth: number;
    pattern: 'halftone' | 'none';
    patternOpacity: number;
}

export const LAYOUT = {
    AREAS: {
        STATUS_BAR: {
            startY: 0,
            height: 60,
            bgColor: 'rgba(26, 26, 29, 0.4)',
            borderColor: 'transparent',
            borderWidth: 0,
            pattern: 'none',
            patternOpacity: 0
        } as AreaTheme,

        NOTICE: {
            startY: 60,
            height: 100,
            bgColor: COLORS.NOTICE_BG,
            borderColor: COLORS.BORDER,
            borderWidth: 2,
            pattern: 'halftone',
            patternOpacity: 0.05
        } as AreaTheme,

        PATH: {
            startY: 160,
            height: 80,
            bgColor: COLORS.DEEP_BG,
            borderColor: COLORS.BORDER,
            borderWidth: 0,
            pattern: 'none',
            patternOpacity: 0
        } as AreaTheme,

        GRID: {
            startY: 240,
            height: 300,
            startX: 40,
            width: 370,
            bgColor: COLORS.GRID_BG,
            borderColor: COLORS.BORDER,
            borderWidth: 6,
            pattern: 'halftone',
            patternOpacity: 0.2
        } as AreaTheme,

        TRANSITION: {
            startY: 540,
            height: 60,
            bgColor: COLORS.TRANSITION_BG,
            borderColor: COLORS.BORDER,
            borderWidth: 2,
            pattern: 'halftone',
            patternOpacity: 0.1
        } as AreaTheme,

        OPERATION: {
            startY: 600,
            height: 200,
            bgColor: COLORS.OP_BG,
            borderColor: COLORS.BORDER,
            borderWidth: 4,
            pattern: 'none',
            patternOpacity: 0
        } as AreaTheme
    }
};
