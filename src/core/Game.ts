import { LAYOUT } from '../styles/layout';
import { Renderer, RenderState, NoticeAsset } from './Renderer';
import { GameEngine, GameEvent } from './GameEngine';
import { SpriteManager } from './SpriteManager';
import { EnemySprite } from './EnemySprite';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private renderer!: Renderer;
    private engine: GameEngine;
    private spriteManager: SpriteManager;

    private readonly GAME_WIDTH = 450;
    private readonly GAME_HEIGHT = 800;

    // IO / Visual State
    private draggingIndex: number = -1;
    private dragPos: { x: number, y: number } | null = null;
    private hoverIndex: number = -1;
    private hoveredButton: string | null = null;
    private pressedButton: string | null = null;
    private pressedTimer: number | null = null;
    private hoveredTower: { r: number, c: number } | null = null;
    private tooltipTimer: number = 0;

    // Visual feedback state
    private boomEffects: { x: number, y: number, text: string, progress: number, color: string }[] = [];
    private particles: any[] = [];
    private hpPopTimer: number = 0;
    private goldPopTimer: number = 0;
    private deckPopTimer: number = 0;
    private prevHp: number = 0;
    private prevGold: number = 0;
    private prevDeckSize: number = 0;

    // Assets & Audio
    private noticeAsset: NoticeAsset | undefined = undefined;
    private assets: Map<string, HTMLImageElement> = new Map();
    private audioCtx: AudioContext | null = null;
    private isBgmPlaying: boolean = false;

    // Layout Constants
    private readonly OP_START_Y = LAYOUT.AREAS.OPERATION.startY;
    private readonly GRID_START_Y = LAYOUT.AREAS.GRID.startY;
    private readonly GRID_HEIGHT = LAYOUT.AREAS.GRID.height;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.canvas.width = this.GAME_WIDTH;
        this.canvas.height = this.GAME_HEIGHT;

        this.renderer = new Renderer(this.ctx);
        this.engine = new GameEngine(this.handleEngineEvent.bind(this));
        this.spriteManager = new SpriteManager();

        this.canvas.addEventListener('mousedown', this.handleStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        this.canvas.addEventListener('mouseup', this.handleEnd);

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleStart(e.touches[0] as any);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e.touches[0] as any);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleEnd(e.changedTouches[0] as any);
        });

        this.initAudio();
        this.resetVisuals();
        requestAnimationFrame(this.gameLoop);
    }

    private handleEngineEvent(event: GameEvent) {
        switch (event.type) {
            case 'sound':
                this.playSound(event.params.freq, event.params.type, event.params.duration, event.params.volume);
                if (event.name === 'reroll' || event.name === 'next_wave') {
                    this.setPressedButton(event.name === 'reroll' ? 'refresh' : 'next_wave');
                }
                break;
            case 'effect':
                if (event.name === 'burst') {
                    const { r, c, x, y, color, count } = event.params;
                    if (r !== undefined && c !== undefined) {
                        const cellWidth = this.GAME_WIDTH / 4, cellHeight = this.GRID_HEIGHT / 5;
                        this.burstParticles(c * cellWidth + cellWidth / 2, this.GRID_START_Y + r * cellHeight + cellHeight / 2, color, count);
                    } else {
                        this.burstParticles(x, y, color, count);
                    }
                } else if (event.name === 'boom') {
                    this.addBoom(event.params.x, event.params.y, 'BOOM!', Math.random() > 0.5 ? '#FFEA00' : '#FF007F');
                }
                break;
        }
    }

    private resetVisuals() {
        this.spriteManager.clear();
        this.prevHp = this.engine.hp;
        this.prevGold = this.engine.gold;
        this.prevDeckSize = this.engine.deck.length + this.engine.cards.filter(c => c !== null).length;
        this.boomEffects = [];
        this.particles = [];
        this.hpPopTimer = 0;
        this.goldPopTimer = 0;
        this.deckPopTimer = 0;
    }

    private initAudio() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
        }
    }

    private startBGM() {
        if (!this.audioCtx || this.isBgmPlaying) return;
        this.isBgmPlaying = true;

        const playBar = (startTime: number) => {
            if (!this.isBgmPlaying || !this.audioCtx) return;
            const duration = 8.0;
            const frequencies = [220, 246.94, 261.63, 293.66];

            frequencies.forEach((freq, i) => {
                const osc = this.audioCtx!.createOscillator();
                const gain = this.audioCtx!.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime + i * 2);
                gain.gain.setValueAtTime(0, startTime + i * 2);
                gain.gain.linearRampToValueAtTime(0.015, startTime + i * 2 + 1);
                gain.gain.linearRampToValueAtTime(0, startTime + i * 2 + 2);
                osc.connect(gain);
                gain.connect(this.audioCtx!.destination);
                osc.start(startTime + i * 2);
                osc.stop(startTime + i * 2 + 2);
            });
            setTimeout(() => { if (this.audioCtx) playBar(this.audioCtx.currentTime); }, duration * 1000 - 100);
        };

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => playBar(this.audioCtx!.currentTime));
        } else {
            playBar(this.audioCtx.currentTime);
        }
    }

    private playSound(freq: number, type: OscillatorType = 'sine', duration: number = 0.1, volume: number = 0.1) {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(volume ?? 0.1, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + (duration ?? 0.1));
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + (duration ?? 0.1));
        } catch (e) { console.error("音频播放失败", e); }
    }

    private setPressedButton(id: string) {
        this.pressedButton = id;
        if (this.pressedTimer) window.clearTimeout(this.pressedTimer);
        this.pressedTimer = window.setTimeout(() => {
            this.pressedButton = null;
        }, 150);

        if (this.audioCtx) {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            this.startBGM();
        }
    }

    private getMousePos(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    private handleStart = (e: MouseEvent) => {
        const pos = this.getMousePos(e);
        const { x, y } = pos;

        if (this.engine.gameOver) {
            if (x >= 125 && x <= 325 && y >= 450 && y <= 500) {
                this.playSound(600, 'sine', 0.2, 0.1);
                this.setPressedButton('restart');
                setTimeout(() => {
                    this.engine.reset();
                    this.resetVisuals();
                }, 150);
            }
            return;
        }

        const btnY = this.OP_START_Y + 105;
        if (x >= 50 && x <= 200 && y >= btnY && y <= btnY + 35) {
            this.engine.handleReroll();
            return;
        }
        if (x >= this.GAME_WIDTH - 200 && x <= this.GAME_WIDTH - 50 && y >= btnY && y <= btnY + 35) {
            if (!this.engine.hasPlacedFirstCard) this.engine.hasPlacedFirstCard = true;
            this.engine.startNextWave();
            return;
        }

        const cardWidth = 60, cardHeight = 85, gap = 20;
        const cardsStartX = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;
        const cardsY = this.OP_START_Y + 10;

        if (y >= cardsY && y <= cardsY + cardHeight) {
            for (let i = 0; i < 3; i++) {
                const cx = cardsStartX + i * (cardWidth + gap);
                if (x >= cx && x <= cx + cardWidth && this.engine.cards[i]) {
                    this.draggingIndex = i;
                    this.hoverIndex = -1;
                    this.dragPos = { x, y };
                    this.playSound(330, 'sine', 0.05, 0.05);
                    return;
                }
            }
        }
    };

    private handleMove = (e: MouseEvent) => {
        if (this.engine.gameOver) return;
        const pos = this.getMousePos(e);
        const { x, y } = pos;

        if (this.draggingIndex === -1) {
            const cardWidth = 60, cardHeight = 85, gap = 20;
            const cardsStartX = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;
            const cardsY = this.OP_START_Y + 10;

            let foundHover = -1;
            let foundBtnHover: string | null = null;

            if (y >= cardsY && y <= cardsY + cardHeight) {
                for (let i = 0; i < 3; i++) {
                    const cx = cardsStartX + i * (cardWidth + gap);
                    if (x >= cx && x <= cx + cardWidth && this.engine.cards[i]) {
                        foundHover = i;
                        break;
                    }
                }
            }

            const btnY = this.OP_START_Y + 105;
            if (y >= btnY && y <= btnY + 38) {
                if (x >= 50 && x <= 200) foundBtnHover = 'refresh';
                else if (x >= this.GAME_WIDTH - 200 && x <= this.GAME_WIDTH - 50) foundBtnHover = 'next_wave';
            }

            this.hoverIndex = foundHover;
            this.hoveredButton = foundBtnHover;
        } else {
            this.dragPos = pos;
            const gridConfig = LAYOUT.AREAS.GRID;
            const startX = gridConfig.startX ?? 0;
            const gridWidth = gridConfig.width ?? this.GAME_WIDTH;
            const cellWidth = gridWidth / 4, cellHeight = gridConfig.height / 5;

            if (y >= gridConfig.startY && y <= gridConfig.startY + gridConfig.height) {
                const col = Math.floor((x - startX) / cellWidth);
                const row = Math.floor((y - gridConfig.startY) / cellHeight);
                if (row >= 0 && row < 5 && col >= 0 && col < 4 && x >= startX && x <= startX + gridWidth) {
                    this.hoverIndex = row * 4 + col;
                    const tower = this.engine.defenseGrid[row][col];
                    if (tower && this.draggingIndex === -1) {
                        this.hoveredTower = { r: row, c: col };
                        this.tooltipTimer = 0;
                    } else {
                        this.hoveredTower = null;
                    }
                } else {
                    this.hoverIndex = -1;
                    this.hoveredTower = null;
                }
            } else {
                this.hoverIndex = -1;
                this.hoveredTower = null;
            }
        }
    };

    private handleEnd = (e: MouseEvent) => {
        if (this.engine.gameOver || this.draggingIndex === -1) return;
        const pos = this.getMousePos(e);
        const { x, y } = pos;

        const gridConfig = LAYOUT.AREAS.GRID;
        const startX = gridConfig.startX ?? 0;
        const gridWidth = gridConfig.width ?? this.GAME_WIDTH;
        const cellWidth = gridWidth / 4, cellHeight = gridConfig.height / 5;

        if (y >= gridConfig.startY && y <= gridConfig.startY + gridConfig.height) {
            const col = Math.floor((x - startX) / cellWidth);
            const row = Math.floor((y - gridConfig.startY) / cellHeight);

            if (row >= 0 && row < 5 && col >= 0 && col < 4 && x >= startX && x <= startX + gridWidth) {
                this.engine.placeCard(this.draggingIndex, row, col);
            }
        }
        this.draggingIndex = -1;
        this.dragPos = null;
    };

    private burstParticles(x: number, y: number, color: string, count: number = 12) {
        for (let k = 0; k < count; k++) {
            this.particles.push({
                x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
                life: 40, color
            });
        }
    }

    private addBoom(x: number, y: number, text: string, color: string) {
        this.boomEffects.push({ x, y, text, progress: 0, color });
    }

    private gameLoop = () => {
        this.update();
        this.render();
        requestAnimationFrame(this.gameLoop);
    };

    private update() {
        const now = Date.now();
        this.engine.update(now);

        // Synchronize Engine Enemies with Sprites
        const currentEnemyIds = new Set(this.engine.enemies.map(e => e.id));

        // Remove dead enemies
        const allSpriteIds = this.spriteManager.getAllIds();
        for (const id of allSpriteIds) {
            if (id.startsWith('enemy-') && !currentEnemyIds.has(id)) {
                this.spriteManager.remove(id);
            }
        }

        for (const enemy of this.engine.enemies) {
            let sprite = this.spriteManager.get(enemy.id);
            if (!sprite) {
                sprite = new EnemySprite(enemy.id);
                this.spriteManager.add(sprite);
            }
            const s = sprite as EnemySprite;
            s.x = enemy.x;
            s.y = enemy.y;
            s.hp = enemy.hp;
            s.maxHp = enemy.maxHp;
            s.update(16); // Direct call to update for simple animation sync
        }
        if (this.engine.hp !== this.prevHp) { this.hpPopTimer = 15; this.prevHp = this.engine.hp; }
        if (this.engine.gold !== this.prevGold) { this.goldPopTimer = 15; this.prevGold = this.engine.gold; }
        const currentDeckSize = this.engine.deck.length + this.engine.cards.filter(c => c !== null).length;
        if (currentDeckSize !== this.prevDeckSize) { this.deckPopTimer = 15; this.prevDeckSize = currentDeckSize; }

        if (this.hpPopTimer > 0) this.hpPopTimer--;
        if (this.goldPopTimer > 0) this.goldPopTimer--;
        if (this.deckPopTimer > 0) this.deckPopTimer--;

        if (this.hoveredTower && this.tooltipTimer < 15) this.tooltipTimer++;

        for (let i = this.boomEffects.length - 1; i >= 0; i--) {
            this.boomEffects[i].progress += 0.025;
            if (this.boomEffects[i].progress >= 1) this.boomEffects.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i]; part.x += part.vx; part.y += part.vy; part.life--;
            if (part.life <= 0) this.particles.splice(i, 1);
        }
    }

    private render() {
        const renderState: RenderState = {
            hp: this.engine.hp,
            gold: this.engine.gold,
            wave: this.engine.wave,
            deckSize: this.engine.deck.length + this.engine.cards.filter(c => c !== null).length,
            cards: this.engine.cards,
            defenseGrid: this.engine.defenseGrid,
            draggingIndex: this.draggingIndex,
            dragPos: this.dragPos,
            hoverIndex: this.hoverIndex,
            hoveredButton: this.hoveredButton,
            pressedButton: this.pressedButton,
            hasPlacedFirstCard: this.engine.hasPlacedFirstCard,
            gameOver: this.engine.gameOver,
            hpPopTimer: this.hpPopTimer,
            goldPopTimer: this.goldPopTimer,
            deckPopTimer: this.deckPopTimer,
            tooltipTimer: this.tooltipTimer,
            hoveredTower: this.hoveredTower,
            enemies: this.engine.enemies,
            projectiles: this.engine.projectiles,
            particles: this.particles,
            boomEffects: this.boomEffects,
            difficultyFactor: this.engine.difficultyFactor,
            isCountdownActive: this.engine.isCountdownActive,
            countdownSeconds: this.engine.countdownSeconds,
            noticeAsset: this.noticeAsset,
            refreshCost: this.engine.refreshCost,
            assets: this.assets,
            spriteManager: this.spriteManager
        };
        this.renderer.render(renderState);
    }

    protected async loadImage(key: string, url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets.set(key, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}
