import { LAYOUT } from '../styles/layout';

export interface Point {
    x: number;
    y: number;
}

export class PathManager {
    public static readonly LEFT = 20;
    public static readonly RIGHT = 430; // 450 - 20

    public static getTop(): number {
        return LAYOUT.AREAS.PATH.startY;
    }

    public static getBottom(): number {
        return LAYOUT.AREAS.TRANSITION.startY + LAYOUT.AREAS.TRANSITION.height;
    }

    /**
     * Gets the position at a given progress t (0 to 1)
     */
    public static getPosition(t: number): Point {
        const top = this.getTop();
        const bottom = this.getBottom();
        const left = this.LEFT;
        const right = this.RIGHT;

        if (t < 0.25) {
            // Top segment: Left to Right
            return { x: left + (t / 0.25) * (right - left), y: top };
        } else if (t < 0.5) {
            // Right segment: Top to Bottom
            return { x: right, y: top + ((t - 0.25) / 0.25) * (bottom - top) };
        } else if (t < 0.75) {
            // Bottom segment: Right to Left
            return { x: right - ((t - 0.5) / 0.25) * (right - left), y: bottom };
        } else {
            // Left segment: Bottom to Top
            return { x: left, y: bottom - ((t - 0.75) / 0.25) * (bottom - top) };
        }
    }

    /**
     * Returns the corner points of the path for rendering
     */
    public static getPathCorners(): Point[] {
        const top = this.getTop();
        const bottom = this.getBottom();
        const left = this.LEFT;
        const right = this.RIGHT;

        return [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom }
        ];
    }
}
