import { Sprite } from './Sprite';
import { COLORS } from '../styles/colors';

export class EnemySprite extends Sprite {
    public hp: number = 0;
    public maxHp: number = 0;

    constructor(id: string) {
        super(id);
        this.width = 16;
        this.height = 16;
        this.zIndex = 10;
    }

    public update(delta: number): void {
        super.update(delta);
        // Any enemy-specific animation logic (e.g. bobbing)
        this.rotation += 0.05;
    }

    public draw(ctx: CanvasRenderingContext2D, assets: Map<string, HTMLImageElement>): void {
        super.draw(ctx, assets);

        // Draw Health Bar
        if (this.visible && this.hp < this.maxHp && this.hp > 0) {
            this.drawHealthBar(ctx);
        }
    }

    private drawHealthBar(ctx: CanvasRenderingContext2D): void {
        const barWidth = 24;
        const barHeight = 4;
        const x = this.x - barWidth / 2;
        const y = this.y - this.height / 2 - 8;

        ctx.save();
        ctx.fillStyle = COLORS.DEEP_BG;
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = COLORS.NEON_CYAN;
        const fillWidth = (this.hp / this.maxHp) * barWidth;
        ctx.fillRect(x, y, fillWidth, barHeight);

        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
        ctx.restore();
    }

    protected drawPlaceholder(ctx: CanvasRenderingContext2D): void {
        // Fallback if no image is assigned to the enemy
        ctx.fillStyle = COLORS.NEON_PINK;
        ctx.beginPath();
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.fill();
        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
