import { Sprite } from './Sprite';

export class SpriteManager {
    private sprites: Map<string, Sprite> = new Map();
    private sortedSprites: Sprite[] = [];
    private needsSort: boolean = false;

    public add(sprite: Sprite): void {
        this.sprites.set(sprite.id, sprite);
        this.needsSort = true;
    }

    public remove(id: string): void {
        if (this.sprites.delete(id)) {
            this.needsSort = true;
        }
    }

    public get(id: string): Sprite | undefined {
        return this.sprites.get(id);
    }

    public getAllIds(): string[] {
        return Array.from(this.sprites.keys());
    }

    public clear(): void {
        this.sprites.clear();
        this.sortedSprites = [];
        this.needsSort = false;
    }

    public update(delta: number): void {
        for (const sprite of this.sprites.values()) {
            sprite.update(delta);
        }
    }

    public draw(ctx: CanvasRenderingContext2D, assets: Map<string, HTMLImageElement>): void {
        if (this.needsSort) {
            this.sortSprites();
        }

        for (const sprite of this.sortedSprites) {
            sprite.draw(ctx, assets);
        }
    }

    private sortSprites(): void {
        this.sortedSprites = Array.from(this.sprites.values()).sort((a, b) => a.zIndex - b.zIndex);
        this.needsSort = false;
    }
}
