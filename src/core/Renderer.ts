import { COLORS } from '../styles/colors';
import { LAYOUT } from '../styles/layout';

export interface NoticeAsset {
    type: 'static' | 'tilemap' | 'animation';
    image?: HTMLImageElement;
    sourceRect?: { x: number, y: number, w: number, h: number };
    animation?: {
        frameWidth: number;
        frameHeight: number;
        totalFrames: number;
        duration: number;
    };
}

export interface RenderState {
    hp: number;
    gold: number;
    wave: number;
    deckSize: number;
    cards: ({ suit: string, value: string } | null)[];
    defenseGrid: ({ suit: string, value: string, level: number, handName?: string, cardCount?: number } | null)[][];
    draggingIndex: number;
    dragPos: { x: number, y: number } | null;
    hoverIndex: number;
    hoveredButton: string | null;
    pressedButton: string | null;
    hasPlacedFirstCard: boolean;
    gameOver: boolean;
    hpPopTimer: number;
    goldPopTimer: number;
    deckPopTimer: number;
    tooltipTimer: number;
    hoveredTower: { r: number, c: number } | null;
    enemies: any[];
    projectiles: any[];
    particles: any[];
    boomEffects: any[];
    difficultyFactor: number;
    isCountdownActive: boolean;
    countdownSeconds: number;
    noticeAsset?: NoticeAsset;
}

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private halftonePattern: CanvasPattern | null = null;
    private readonly GAME_WIDTH = 450;
    private readonly GAME_HEIGHT = 800;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.initHalftone();
    }

    private initHalftone() {
        const size = 4;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = COLORS.BORDER;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
        ctx.fill();
        this.halftonePattern = this.ctx.createPattern(canvas, 'repeat');
    }

    public render(state: RenderState) {
        this.ctx.clearRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // --- Layer 1: Backgrounds & Environment ---
        this.drawAllBackgrounds();
        this.drawPathTrail();

        // --- Layer 2: Area Specific Contents ---
        this.drawTopBar(state);
        this.drawNoticeArea(state);

        if (!state.hasPlacedFirstCard && !state.gameOver && state.draggingIndex === -1) {
            this.drawComicBanner(this.GAME_WIDTH / 2, 400, 'PLACE FIRST CARD TO START');
        }

        this.drawDefenseArea(state);
        this.drawTransitionArea();
        this.drawOperationArea(state);

        // --- Layer 3: Dynamic Entities (Enemies, Bullets) ---
        this.drawEntities(state);

        if (state.gameOver) { this.drawGameOver(state); }
        else if (state.difficultyFactor > 2) {
            this.ctx.strokeStyle = '#ff000022';
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        }
    }

    private drawAreaBackground(areaId: keyof typeof LAYOUT.AREAS) {
        const area = LAYOUT.AREAS[areaId];
        const x = area.startX ?? 0;
        const w = area.width ?? this.GAME_WIDTH;

        this.ctx.save();
        // 底色始终铺满背景，防止左右出现空隙
        this.ctx.fillStyle = area.bgColor;
        this.ctx.fillRect(0, area.startY, this.GAME_WIDTH, area.height);

        // 只有花纹（如波点）跟随定义的宽度
        if (area.pattern === 'halftone' && this.halftonePattern) {
            this.ctx.save();
            this.ctx.globalAlpha = area.patternOpacity;
            this.ctx.fillStyle = this.halftonePattern;
            this.ctx.fillRect(x, area.startY, w, area.height);
            this.ctx.restore();
        }

        // 只有边框跟随定义的宽度
        if (area.borderWidth > 0) {
            this.ctx.strokeStyle = area.borderColor;
            this.ctx.lineWidth = area.borderWidth;
            this.ctx.strokeRect(x, area.startY, w, area.height);
        }
        this.ctx.restore();
    }

    private drawAllBackgrounds() {
        // Draw backgrounds in logical order from top to bottom
        const areaIds: (keyof typeof LAYOUT.AREAS)[] = [
            'STATUS_BAR', 'NOTICE', 'PATH', 'GRID', 'TRANSITION', 'OPERATION'
        ];
        areaIds.forEach(id => this.drawAreaBackground(id));
    }

    private drawTopBar(state: RenderState) {
        const badgeY = 30;
        this.drawStatusBadge(65, badgeY, '❤️', state.hp, COLORS.SUIT_RED, state.hpPopTimer, -2);
        this.drawStatusBadge(this.GAME_WIDTH / 2, badgeY, '🃏', state.deckSize, COLORS.SUIT_BLACK, state.deckPopTimer, 2);
        this.drawStatusBadge(this.GAME_WIDTH - 65, badgeY, '💰', state.gold, '#FFD700', state.goldPopTimer, -1);
    }

    private drawStatusBadge(x: number, y: number, icon: string, value: number | string, color: string, popTimer: number, rotation: number) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation * Math.PI / 180);

        const w = 110, h = 40;
        const drawX = -w / 2, drawY = -h / 2;

        this.ctx.fillStyle = COLORS.BORDER;
        this.ctx.beginPath(); this.ctx.roundRect(drawX + 4, drawY + 4, w, h, 20); this.ctx.fill();

        this.ctx.fillStyle = COLORS.OFF_WHITE;
        this.ctx.beginPath(); this.ctx.roundRect(drawX, drawY, w, h, 20); this.ctx.fill();
        this.ctx.strokeStyle = COLORS.BORDER;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(icon, drawX + 12, 0);

        this.ctx.save();
        if (popTimer > 0) {
            const progress = popTimer / 15;
            const popScale = 1 + Math.sin(progress * Math.PI) * 0.5;
            const popRotate = Math.sin(progress * Math.PI) * 5 * Math.PI / 180;
            this.ctx.scale(popScale, popScale);
            this.ctx.rotate(popRotate);
        }

        const fontMain = 'Bangers, Anton, Impact';
        this.ctx.font = 'bold 24px ' + fontMain;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const isBlackText = color === COLORS.SUIT_BLACK || color === '#000000' || color === '#2B2B2B';

        if (isBlackText) {
            this.ctx.fillStyle = COLORS.NEON_CYAN;
            this.ctx.fillText(value.toString(), 25 + 2, 2);
            this.ctx.strokeStyle = COLORS.OFF_WHITE;
            this.ctx.lineWidth = 4;
            this.ctx.strokeText(value.toString(), 25, 0);
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(value.toString(), 25, 0);
        } else {
            this.ctx.fillStyle = COLORS.BORDER;
            this.ctx.fillText(value.toString(), 25 + 2, 2);
            this.ctx.strokeStyle = COLORS.BORDER;
            this.ctx.lineWidth = 4;
            this.ctx.strokeText(value.toString(), 25, 0);
            this.ctx.fillStyle = color;
            this.ctx.fillText(value.toString(), 25, 0);
        }

        this.ctx.restore();
        this.ctx.restore();
    }

    private drawNoticeArea(state: RenderState) {
        const config = LAYOUT.AREAS.NOTICE;

        const asset = state.noticeAsset;
        if (asset && asset.image) {
            this.ctx.save();
            // --- IMAGE LOGIC ---
            if (asset.type === 'static') {
                // Logic 1: Ordinary Static Image
                this.ctx.drawImage(asset.image, 0, config.startY, this.GAME_WIDTH, config.height);
            } else if (asset.type === 'tilemap' && asset.sourceRect) {
                // Logic 2: Tilemap (Sub-rect)
                const { x, y, w, h } = asset.sourceRect;
                this.ctx.drawImage(asset.image, x, y, w, h, 0, config.startY, this.GAME_WIDTH, config.height);
            } else if (asset.type === 'animation' && asset.animation) {
                // Logic 3: Animation Frames
                const anim = asset.animation;
                const frame = Math.floor(Date.now() / anim.duration) % anim.totalFrames;
                const sx = frame * anim.frameWidth;
                this.ctx.drawImage(asset.image, sx, 0, anim.frameWidth, anim.frameHeight, 0, config.startY, this.GAME_WIDTH, config.height);
            }
            this.ctx.restore();
        } else {
            // Fallback: Current的效果 (纯色背景 + 占位文字)
            this.ctx.fillStyle = COLORS.OFF_WHITE;
            this.ctx.font = 'italic 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillText('--- SYSTEM NOTIFICATION AREA ---', this.GAME_WIDTH / 2, config.startY + config.height / 2 + 5);
            this.ctx.globalAlpha = 1.0;
        }
    }

    private drawTransitionArea() {
        const config = LAYOUT.AREAS.TRANSITION;
        this.ctx.fillStyle = COLORS.NEON_CYAN;
        this.ctx.font = 'bold 10px Bangers';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DRAG CARDS TO DEFEND THE CORE', this.GAME_WIDTH / 2, config.startY + config.height / 2 + 5);
    }

    private drawPathTrail() {
        const pathConfig = LAYOUT.AREAS.PATH;
        const transConfig = LAYOUT.AREAS.TRANSITION;

        // Path starts at the beginning of the PATH area and ends at the end of the TRANSITION area
        const top = pathConfig.startY;
        const bottom = transConfig.startY + transConfig.height;
        const left = 20, right = this.GAME_WIDTH - 20;

        this.ctx.save();
        this.ctx.strokeStyle = COLORS.BORDER;
        this.ctx.lineWidth = 34;
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(left, top);
        this.ctx.lineTo(right, top);
        this.ctx.lineTo(right, bottom);
        this.ctx.lineTo(left, bottom);
        this.ctx.closePath();
        this.ctx.stroke();

        this.ctx.strokeStyle = '#2c2c2e';
        this.ctx.lineWidth = 30;
        this.ctx.stroke();
        this.ctx.restore();
    }

    private drawDefenseArea(state: RenderState) {
        const gridConfig = LAYOUT.AREAS.GRID;
        const startX = gridConfig.startX ?? 0;
        const gridWidth = gridConfig.width ?? this.GAME_WIDTH;
        const cellWidth = gridWidth / 4, cellHeight = gridConfig.height / 5;

        if (state.draggingIndex !== -1 && state.hoverIndex === -1) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
            this.ctx.save();
            this.ctx.strokeStyle = COLORS.NEON_PINK;
            this.ctx.globalAlpha = 0.4 + pulse * 0.6;
            this.ctx.lineWidth = 6 + pulse * 4;
            this.ctx.strokeRect(startX, gridConfig.startY, gridWidth, gridConfig.height);
            this.ctx.restore();

            this.ctx.save();
            this.ctx.globalAlpha = 0.1 + pulse * 0.1;
            this.ctx.fillStyle = COLORS.NEON_PINK;
            this.ctx.fillRect(startX, gridConfig.startY, gridWidth, gridConfig.height);
            this.ctx.restore();
        }

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const x = startX + c * cellWidth, y = gridConfig.startY + r * cellHeight;
                const isHovered = (state.draggingIndex !== -1 && state.hoverIndex === r * 4 + c);

                this.ctx.save();
                if (isHovered) {
                    this.ctx.translate(x + cellWidth / 2, y + cellHeight / 2);
                    this.ctx.scale(1.05, 1.05);
                    this.ctx.translate(-(x + cellWidth / 2), -(y + cellHeight / 2));
                    this.ctx.fillStyle = COLORS.NEON_PINK;
                    this.ctx.fillRect(x, y, cellWidth, cellHeight);
                } else {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                    this.ctx.fillRect(x, y, cellWidth, cellHeight);
                }

                this.ctx.strokeStyle = COLORS.BORDER;
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, y, cellWidth, cellHeight);

                const tower = state.defenseGrid[r][c];
                if (tower) {
                    this.drawCard(this.ctx, x, y, tower.suit, tower.value, cellWidth, cellHeight, 12, 'normal', true);
                    if (tower.handName) {
                        this.ctx.fillStyle = COLORS.BG_PAPER;
                        this.ctx.strokeStyle = COLORS.BORDER;
                        this.ctx.lineWidth = 2;
                        this.ctx.font = 'bold 9px Arial';
                        const tw = this.ctx.measureText(tower.handName).width;
                        this.ctx.fillRect(x + cellWidth / 2 - tw / 2 - 2, y + cellHeight - 15, tw + 4, 12);
                        this.ctx.strokeRect(x + cellWidth / 2 - tw / 2 - 2, y + cellHeight - 15, tw + 4, 12);
                        this.ctx.fillStyle = COLORS.BORDER;
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(tower.handName, x + cellWidth / 2, y + cellHeight - 6);
                    }
                    if (tower.level > 1) {
                        this.ctx.fillStyle = COLORS.BORDER;
                        this.ctx.fillRect(x + cellWidth - 28, y + 5, 23, 11);
                        this.ctx.fillStyle = COLORS.BG_PAPER;
                        this.ctx.font = 'bold 9px Arial';
                        this.ctx.textAlign = 'right';
                        this.ctx.fillText(`L${tower.level}`, x + cellWidth - 8, y + 14);
                    }
                } else {
                    this.ctx.fillStyle = isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)';
                    this.ctx.font = 'bold 32px Bangers';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('+', x + cellWidth / 2, y + cellHeight / 2);
                }
                this.ctx.restore();
            }
        }

        if (state.hoveredTower && state.tooltipTimer > 0) {
            const r = state.hoveredTower.r, c = state.hoveredTower.c;
            const tower = state.defenseGrid[r][c];
            if (tower) {
                const tx = c * cellWidth + cellWidth / 2;
                const ty = gridConfig.startY + r * cellHeight;
                this.drawSpeechBubble(this.ctx, tx, ty - 10, tower.handName || 'TOWER', `LVL: ${tower.level}`);
            }
        }
    }

    private drawOperationArea(state: RenderState) {
        const opConfig = LAYOUT.AREAS.OPERATION;
        const cardWidth = 66, cardHeight = 92, gap = 20;
        const xOffset = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;

        for (let i = 0; i < 3; i++) {
            const card = state.cards[i];
            const cx = xOffset + i * (cardWidth + gap), cy = opConfig.startY + 10;
            if (card && state.draggingIndex !== i) {
                const cardState = state.hoverIndex === i ? 'hover' : 'normal';
                this.drawCard(this.ctx, cx, cy, card.suit, card.value, cardWidth, cardHeight, 20, cardState);
            }
            else if (!card) { this.ctx.strokeStyle = '#222'; this.ctx.strokeRect(cx, cy, cardWidth, cardHeight); }
        }
        if (state.draggingIndex !== -1 && state.dragPos) {
            const card = state.cards[state.draggingIndex]!;
            this.drawCard(this.ctx, state.dragPos.x - 33, state.dragPos.y - 46, card.suit, card.value, 66, 92, 20, 'active');
        }
        const btnY = opConfig.startY + 105;

        const refreshState = state.pressedButton === 'refresh' ? 'active' : (state.hoveredButton === 'refresh' ? 'hover' : 'normal');
        this.drawButton(50, btnY, 150, 38, `🔄 REFRESH (5G)`, COLORS.NEON_CYAN, refreshState);

        let nextWaveText = state.hasPlacedFirstCard ? '▶ NEXT WAVE' : '⏳ PREPARING';
        if (state.isCountdownActive) nextWaveText = `⌛ AUTO (${state.countdownSeconds}s)`;
        const nextWaveState = state.pressedButton === 'next_wave' ? 'active' : (state.hoveredButton === 'next_wave' ? 'hover' : 'normal');

        let nextWaveColor = state.hasPlacedFirstCard ? COLORS.NEON_YELLOW : '#555';
        this.drawButton(this.GAME_WIDTH - 200, btnY, 150, 38, nextWaveText, nextWaveColor, nextWaveState);
    }

    private drawEntities(state: RenderState) {
        for (const enemy of state.enemies) {
            this.ctx.fillStyle = '#ff4444'; this.ctx.beginPath(); this.ctx.arc(enemy.x, enemy.y, 11, 0, Math.PI * 2); this.ctx.fill();
            const hpWidth = 26; this.ctx.fillStyle = '#440000'; this.ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 20, hpWidth, 4);
            this.ctx.fillStyle = '#00ff00'; this.ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 20, hpWidth * (enemy.hp / enemy.maxHp), 4);
        }
        for (const p of state.projectiles) { this.ctx.fillStyle = '#f1c40f'; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); this.ctx.fill(); }
        for (const part of state.particles) { this.ctx.fillStyle = part.color; this.ctx.globalAlpha = part.life / 40; this.ctx.fillRect(part.x, part.y, 3, 3); this.ctx.globalAlpha = 1.0; }

        for (const boom of state.boomEffects) {
            this.drawBoom(this.ctx, boom.x, boom.y, boom.text, boom.progress, boom.color);
        }
    }

    public drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, suit: string, value: string, width: number, height: number, fontSize: number = 20, state: 'normal' | 'hover' | 'active' = 'normal', inGrid: boolean = false) {
        ctx.save();
        let shadowDist = 4;
        let tilt = 0;
        let scale = 1;
        let cornerRadius = 8;

        if (inGrid) {
            shadowDist = 2;
            cornerRadius = 4;
        } else {
            if (state === 'hover') {
                shadowDist = 10;
                y -= 8;
                tilt = -0.03;
                scale = 1.05;
            } else if (state === 'active') {
                shadowDist = 2;
                y += 2;
            }
        }

        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(tilt);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);

        ctx.fillStyle = COLORS.BORDER;
        ctx.beginPath(); ctx.roundRect(shadowDist, shadowDist, width, height, cornerRadius); ctx.fill();

        ctx.fillStyle = COLORS.BG_PAPER;
        ctx.beginPath(); ctx.roundRect(0, 0, width, height, cornerRadius); ctx.fill();
        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = inGrid ? 2 : 3;
        ctx.stroke();

        const isRed = suit === '♥' || suit === '♦';
        const mainFont = 'Bangers, Anton, "Courier New"';

        if (inGrid) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const valSize = 46;
            const suitSize = 34;
            const valX = width * 0.38;
            const valY = height / 2;
            const suitX = width * 0.76;
            const suitY = height / 2 + 4;

            this.drawDoubleOutlineText(ctx, value, valX, valY, valSize, !isRed, mainFont);
            this.drawDoubleOutlineText(ctx, suit, suitX, suitY, suitSize, !isRed, mainFont);
        } else {
            ctx.fillStyle = isRed ? COLORS.SUIT_RED : COLORS.SUIT_BLACK;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${fontSize}px ${mainFont}`;
            ctx.fillText(value, width * 0.1, height * 0.08);
            ctx.font = `${fontSize * 0.8}px ${mainFont}`;
            ctx.fillText(suit, width * 0.1, height * 0.32);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${fontSize * 2.5}px ${mainFont}`;
            ctx.fillText(suit, width / 2, height / 2 + 5);

            ctx.save();
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${fontSize}px ${mainFont}`;
            ctx.fillText(value, width * 0.1, height * 0.08);
            ctx.font = `${fontSize * 0.8}px ${mainFont}`;
            ctx.fillText(suit, width * 0.1, height * 0.32);
            ctx.restore();
        }

        ctx.restore();
    }

    private drawDoubleOutlineText(ctx: CanvasRenderingContext2D, text: string, tx: number, ty: number, fSize: number, isBlack: boolean, mainFont: string) {
        ctx.font = `bold ${fSize}px ${mainFont}`;

        if (isBlack) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 10;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, tx, ty);

            const glowColor = COLORS.NEON_CYAN;
            const ring = 2.5;
            const offsets = [
                [-ring, -ring], [ring, -ring], [-ring, ring], [ring, ring],
                [0, -ring], [0, ring], [-ring, 0], [ring, 0]
            ];
            ctx.fillStyle = glowColor;
            for (const [ox, oy] of offsets) {
                ctx.fillText(text, tx + ox, ty + oy);
            }
            ctx.fillStyle = glowColor;
            ctx.fillText(text, tx + 4, ty + 4);
            ctx.fillStyle = '#000000';
            ctx.fillText(text, tx, ty);

        } else {
            ctx.strokeStyle = COLORS.BORDER;
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.fillStyle = COLORS.BORDER;
            ctx.fillText(text, tx + 3, ty + 3);
            ctx.strokeText(text, tx, ty);
            ctx.fillStyle = COLORS.SUIT_RED;
            ctx.fillText(text, tx, ty);
        }
    }

    public drawButton(x: number, y: number, w: number, h: number, text: string, color: string, state: 'normal' | 'hover' | 'active' = 'normal') {
        this.ctx.save();
        let shadowDist = 6;
        let skew = -0.08;
        let tx = 0, ty = 0;

        if (state === 'hover') {
            shadowDist = 8;
            tx = -2; ty = -2;
        } else if (state === 'active') {
            shadowDist = 0;
            tx = 6; ty = 6;
        }

        this.ctx.translate(x + tx, y + ty);
        this.ctx.transform(1, 0, skew, 1, 0, 0);

        if (shadowDist > 0) {
            this.ctx.fillStyle = COLORS.BORDER;
            this.ctx.beginPath(); this.ctx.roundRect(shadowDist, shadowDist, w, h, 4); this.ctx.fill();
        }

        this.ctx.fillStyle = color;
        this.ctx.beginPath(); this.ctx.roundRect(0, 0, w, h, 4); this.ctx.fill();
        this.ctx.strokeStyle = COLORS.BORDER;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.fillStyle = (color === COLORS.NEON_YELLOW) ? COLORS.BORDER : COLORS.OFF_WHITE;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = 'bold 16px Bangers, Anton, Impact';

        // --- BUTTON LEGIBILITY FIX ---
        // If background is Yellow, the black text smear with black outline.
        // We use a white stroke or no stroke for the text when background is light.
        if (color === COLORS.NEON_YELLOW) {
            this.ctx.strokeStyle = COLORS.OFF_WHITE;
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(text, w / 2, h / 2);
        } else {
            this.ctx.strokeStyle = COLORS.BORDER;
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(text, w / 2, h / 2);
        }

        this.ctx.fillText(text, w / 2, h / 2);
        this.ctx.restore();
    }

    private drawGameOver(state: RenderState) {
        this.ctx.fillStyle = 'rgba(26, 26, 29, 0.9)'; this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        this.ctx.fillStyle = COLORS.SUIT_RED; this.ctx.font = 'bold 64px Bangers'; this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.GAME_WIDTH / 2, 320);

        this.ctx.fillStyle = COLORS.BG_PAPER; this.ctx.font = '24px Anton';
        this.ctx.fillText(`WAVE: ${state.wave}`, this.GAME_WIDTH / 2, 380);
        this.ctx.fillText(`GOLD: ${state.gold}G`, this.GAME_WIDTH / 2, 410);

        const restartState = state.pressedButton === 'restart' ? 'active' : (state.hoveredButton === 'restart' ? 'hover' : 'normal');
        this.drawButton(this.GAME_WIDTH / 2 - 100, 450, 200, 50, 'RESTART', '#27ae60', restartState);
    }

    private drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, content: string) {
        ctx.save();
        const w = 120, h = 50;
        const bx = -w / 2, by = -h - 15;
        ctx.translate(x, y);

        ctx.fillStyle = COLORS.BORDER;
        ctx.beginPath(); ctx.roundRect(bx + 6, by + 6, w, h, 8); ctx.fill();

        ctx.fillStyle = '#FFF9E6';
        ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill();
        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = COLORS.BORDER;
        ctx.beginPath();
        ctx.moveTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(0, 0); ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFF9E6';
        ctx.beginPath();
        ctx.moveTo(-7, -15); ctx.lineTo(7, -15); ctx.lineTo(0, -4); ctx.closePath();
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.SUIT_RED;
        ctx.font = 'bold 16px Bangers';
        ctx.fillText(title, 0, by + 20);

        ctx.fillStyle = COLORS.BORDER;
        ctx.font = 'bold 12px Arial';
        ctx.fillText(content, 0, by + 40);
        ctx.restore();
    }

    private drawBoom(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, progress: number, color: string) {
        ctx.save();
        ctx.translate(x, y);
        let scale = 1.2, opacity = 1, translateY = 0, rotate = 0;

        if (progress < 0.1) { scale = progress / 0.1 * 1.6; rotate = 5; }
        else if (progress < 0.3) { scale = 1.6 - (progress - 0.1) / 0.2 * 0.4; rotate = -8; }
        else if (progress < 0.8) { scale = 1.2; translateY = -(progress - 0.3) / 0.5 * 60; rotate = -12; opacity = 1 - (progress - 0.6) / 0.2 * 0.2; }
        else { scale = 1.2 - (progress - 0.8) / 0.2 * 0.4; translateY = -60 - (progress - 0.8) / 0.2 * 40; rotate = -15; opacity = 0.8 - (progress - 0.8) / 0.2 * 0.8; }

        ctx.scale(scale, scale);
        ctx.translate(0, translateY);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, opacity);

        ctx.fillStyle = COLORS.NEON_YELLOW;
        ctx.shadowColor = COLORS.BORDER;
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;

        ctx.beginPath();
        const points = 16, innerRadius = 30, outerRadius = 50;
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / points;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = COLORS.BORDER; ctx.lineWidth = 3; ctx.stroke();

        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.font = 'bold 32px Bangers';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = COLORS.BORDER; ctx.lineWidth = 3; ctx.strokeText(text, 0, 0);
        ctx.fillStyle = color; ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    private drawComicBanner(x: number, y: number, text: string) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(-0.05);
        const w = 320, h = 60;

        this.ctx.fillStyle = COLORS.BORDER;
        this.ctx.beginPath(); this.ctx.roundRect(-w / 2 + 8, -h / 2 + 8, w, h, 4); this.ctx.fill();

        this.ctx.fillStyle = COLORS.NEON_YELLOW;
        this.ctx.beginPath(); this.ctx.roundRect(-w / 2, -h / 2, w, h, 4); this.ctx.fill();
        this.ctx.strokeStyle = COLORS.BORDER;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.font = 'bold 24px Bangers';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // --- BANNER LEGIBILITY FIX ---
        this.ctx.strokeStyle = COLORS.OFF_WHITE;
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(text, 0, 0);

        this.ctx.fillStyle = COLORS.BORDER;
        this.ctx.fillText(text, 0, 0);
        this.ctx.restore();
    }
}
