export class Sprite {
    public x: number = 0;
    public y: number = 0;
    public width: number = 0;
    public height: number = 0;
    public alpha: number = 1.0;
    public scale: number = 1.0;
    public rotation: number = 0;
    public imageKey: string | null = null;
    public zIndex: number = 0;
    public visible: boolean = true;
    public id: string;

    constructor(id: string) {
        this.id = id;
    }

    public update(_delta: number): void {
        // Base update logic (can be overridden)
    }

    public draw(ctx: CanvasRenderingContext2D, assets: Map<string, HTMLImageElement>): void {
        if (!this.visible || this.alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.alpha;

        if (this.imageKey && assets.has(this.imageKey)) {
            const img = assets.get(this.imageKey)!;
            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Placeholder drawing logic if no image
            this.drawPlaceholder(ctx);
        }

        ctx.restore();
    }

    protected drawPlaceholder(_ctx: CanvasRenderingContext2D): void {
        // To be implemented by subclasses if needed
    }
}
