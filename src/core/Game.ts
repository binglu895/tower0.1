import { LAYOUT } from '../styles/layout';
import { Renderer, RenderState, NoticeAsset } from './Renderer';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private renderer!: Renderer;

    private readonly GAME_WIDTH = 450;
    private readonly GAME_HEIGHT = 800;

    private hp: number = 3;
    private wave: number = 0;
    private gold: number = 10;
    private gameOver: boolean = false;
    private hasPlacedFirstCard: boolean = false;

    private cards: ({ suit: string, value: string } | null)[] = [];
    private defenseGrid: ({ suit: string, value: string, level: number, handName?: string, cardCount?: number } | null)[][] = [];

    private deck: { suit: string, value: string }[] = [];

    private refreshCost: number = 5;

    private countdownSeconds: number = 0;
    private isCountdownActive: boolean = false;
    private lastCountdownSnapshot: number = 0;

    private pressedButton: string | null = null;
    private pressedTimer: number | null = null;

    private readonly SUITS = ['♠', '♥', '♣', '♦'];
    private readonly VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // 布局及样式常量全部从 modular styles 引入
    private readonly DEF_START_Y = LAYOUT.AREAS.GRID.startY;
    private readonly DEF_HEIGHT = LAYOUT.AREAS.GRID.height;
    private readonly OP_START_Y = LAYOUT.AREAS.OPERATION.startY;

    private enemies: any[] = [];
    private projectiles: any[] = [];
    private particles: any[] = [];
    private lastSpawnTime: number = 0;
    private remainingToSpawn: number = 0;

    private audioCtx: AudioContext | null = null;
    private isBgmPlaying: boolean = false;

    private difficultyFactor: number = 1.0;
    private waveKillDistSum: number = 0;
    private waveEnemiesKilled: number = 0;

    private draggingIndex: number = -1;
    private dragPos: { x: number, y: number } | null = null;

    private towerCooldowns: Map<string, number> = new Map();
    private hoverIndex: number = -1;
    private hoveredButton: string | null = null;

    // 状态栏动画追踪
    private prevHp: number = 0;
    private prevGold: number = 0;
    private prevDeckSize: number = 0;
    private hpPopTimer: number = 0;
    private goldPopTimer: number = 0;
    private deckPopTimer: number = 0;

    // 悬停塔提示与战斗飘字
    private hoveredTower: { r: number, c: number } | null = null;
    private tooltipTimer: number = 0;
    private boomEffects: { x: number, y: number, text: string, progress: number, color: string }[] = [];

    private noticeAsset: NoticeAsset | undefined = undefined;
    private assets: Map<string, HTMLImageElement> = new Map();

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.canvas.width = this.GAME_WIDTH;
        this.canvas.height = this.GAME_HEIGHT;

        this.renderer = new Renderer(this.ctx);

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
        this.resetGame();
        requestAnimationFrame(this.gameLoop);
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


    private resetGame() {
        this.hp = 3;
        this.gold = 10;
        this.wave = 0;
        this.gameOver = false;
        this.hasPlacedFirstCard = false;
        this.difficultyFactor = 1.0;
        this.refreshCost = 5;
        this.waveKillDistSum = 0;
        this.waveEnemiesKilled = 0;

        this.cards = [];
        this.defenseGrid = [];
        for (let r = 0; r < 5; r++) {
            this.defenseGrid[r] = new Array(4).fill(null);
        }

        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.towerCooldowns.clear();
        this.remainingToSpawn = 0;
        this.isCountdownActive = false;

        this.prevHp = this.hp;
        this.prevGold = this.gold;
        this.initDeck();
        this.prevDeckSize = this.deck.length + this.cards.filter(c => c !== null).length;
        this.refreshCards();
    }

    private initDeck() {
        this.deck = [];
        for (const suit of this.SUITS) {
            for (const value of this.VALUES) {
                this.deck.push({ suit, value });
            }
        }
        this.shuffleDeck();
    }

    private shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
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
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) { console.error("音频播放失败", e); }
    }

    private refreshCards() {
        for (let i = 0; i < 3; i++) {
            if (!this.cards[i] && this.deck.length > 0) {
                this.cards[i] = this.deck.pop() || null;
            }
        }
    }

    private forceRefreshCards() {
        for (let i = 0; i < 3; i++) {
            if (this.cards[i]) {
                this.deck.push(this.cards[i]!);
                this.cards[i] = null;
            }
        }
        this.shuffleDeck();
        this.refreshCards();
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

        if (this.gameOver) {
            if (x >= 125 && x <= 325 && y >= 450 && y <= 500) {
                this.playSound(600, 'sine', 0.2, 0.1);
                this.setPressedButton('restart');
                setTimeout(() => this.resetGame(), 150);
            }
            return;
        }

        const btnY = this.OP_START_Y + 105;
        if (x >= 50 && x <= 200 && y >= btnY && y <= btnY + 35) {
            if (this.gold >= this.refreshCost) {
                this.gold -= this.refreshCost;
                this.forceRefreshCards();
                const calculatedCost = Math.floor(this.gold * 0.4);
                if (calculatedCost > this.refreshCost) this.refreshCost = calculatedCost;
                this.setPressedButton('refresh');
                this.playSound(500, 'sine', 0.1, 0.05);
            }
            return;
        }
        if (x >= this.GAME_WIDTH - 200 && x <= this.GAME_WIDTH - 50 && y >= btnY && y <= btnY + 35) {
            if (!this.hasPlacedFirstCard) this.hasPlacedFirstCard = true;
            this.isCountdownActive = false;
            this.startNextWave();
            return;
        }

        const cardWidth = 60, cardHeight = 85, gap = 20;
        const cardsStartX = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;
        const cardsY = this.OP_START_Y + 10;

        if (y >= cardsY && y <= cardsY + cardHeight) {
            for (let i = 0; i < 3; i++) {
                const cx = cardsStartX + i * (cardWidth + gap);
                if (x >= cx && x <= cx + cardWidth && this.cards[i]) {
                    this.draggingIndex = i;
                    this.hoverIndex = -1; // 强制重置，确保立即触发全域引导
                    this.dragPos = { x, y };
                    this.playSound(330, 'sine', 0.05, 0.05);
                    return;
                }
            }
        }
    };

    private startCountdown(duration: number) {
        this.countdownSeconds = Math.max(10, Math.min(25, Math.ceil(duration)));
        this.isCountdownActive = true;
        this.lastCountdownSnapshot = Date.now();
    }

    private startNextWave() {
        if (this.remainingToSpawn > 0 || this.enemies.length > 0) return;
        if (this.wave > 0 && this.waveEnemiesKilled > 0) {
            const avgDist = this.waveKillDistSum / this.waveEnemiesKilled;
            if (avgDist < 0.4) this.difficultyFactor *= 1.4;
            else if (avgDist < 0.6) this.difficultyFactor *= 1.1;
            this.waveKillDistSum = 0;
            this.waveEnemiesKilled = 0;
        }
        this.wave++;
        this.remainingToSpawn = 5 + Math.floor(this.wave / 1.5);
        this.isCountdownActive = false;
        this.setPressedButton('next_wave');
        this.playSound(440, 'triangle', 0.1, 0.05);
    }

    private handleMove = (e: MouseEvent) => {
        if (this.gameOver) return;
        const pos = this.getMousePos(e);
        const { x, y } = pos;

        if (this.draggingIndex === -1) {
            // 检测备选卡牌悬停
            const cardWidth = 60, cardHeight = 85, gap = 20;
            const cardsStartX = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;
            const cardsY = this.OP_START_Y + 10;

            let foundHover = -1;
            let foundBtnHover: string | null = null;

            if (y >= cardsY && y <= cardsY + cardHeight) {
                for (let i = 0; i < 3; i++) {
                    const cx = cardsStartX + i * (cardWidth + gap);
                    if (x >= cx && x <= cx + cardWidth && this.cards[i]) {
                        foundHover = i;
                        break;
                    }
                }
            }

            if (this.gameOver) {
                if (x >= 125 && x <= 325 && y >= 450 && y <= 500) foundBtnHover = 'restart';
            } else {
                const btnY = this.OP_START_Y + 105;
                if (y >= btnY && y <= btnY + 38) {
                    if (x >= 50 && x <= 200) foundBtnHover = 'refresh';
                    else if (x >= this.GAME_WIDTH - 200 && x <= this.GAME_WIDTH - 50) foundBtnHover = 'next_wave';
                }
            }

            if (this.hoverIndex !== foundHover) this.hoverIndex = foundHover;
            if (this.hoveredButton !== foundBtnHover) this.hoveredButton = foundBtnHover;
        } else {
            this.dragPos = pos;

            // 拖拽时检测格点悬停
            const gridConfig = LAYOUT.AREAS.GRID;
            const startX = gridConfig.startX ?? 0;
            const gridWidth = gridConfig.width ?? this.GAME_WIDTH;
            const cellWidth = gridWidth / 4, cellHeight = gridConfig.height / 5;

            if (y >= gridConfig.startY && y <= gridConfig.startY + gridConfig.height) {
                const col = Math.floor((x - startX) / cellWidth);
                const row = Math.floor((y - gridConfig.startY) / cellHeight);
                if (row >= 0 && row < 5 && col >= 0 && col < 4 && x >= startX && x <= startX + gridWidth) {
                    this.hoverIndex = row * 4 + col;

                    // 塔提示检测 (仅在非拖拽且悬停在已放置的塔上时)
                    const tower = this.defenseGrid[row][col];
                    if (tower && this.draggingIndex === -1) {
                        if (!this.hoveredTower || this.hoveredTower.r !== row || this.hoveredTower.c !== col) {
                            this.hoveredTower = { r: row, c: col };
                            this.tooltipTimer = 0;
                        }
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
        if (this.gameOver || this.draggingIndex === -1) return;
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
                const card = this.cards[this.draggingIndex];
                if (!card) return;
                const existing = this.defenseGrid[row][col];
                if (!existing) {
                    this.defenseGrid[row][col] = { ...card, level: 1, cardCount: 1 };
                    this.cards[this.draggingIndex] = null;
                    this.playSound(660, 'sine', 0.1, 0.1);
                    this.checkOmniMerge(row, col);
                    this.refreshCards();
                    if (!this.hasPlacedFirstCard) {
                        this.hasPlacedFirstCard = true;
                        this.startCountdown(10);
                    }
                } else if (existing.suit === card.suit && existing.value === card.value) {
                    existing.level++;
                    existing.cardCount = (existing.cardCount || 1) + 1;
                    this.cards[this.draggingIndex] = null;
                    this.playSound(880, 'sine', 0.1, 0.2);
                    this.burstParticles(startX + col * cellWidth + cellWidth / 2, gridConfig.startY + row * cellHeight + cellHeight / 2, '#f1c40f');
                    this.checkOmniMerge(row, col);
                    this.refreshCards();
                    if (!this.hasPlacedFirstCard) {
                        this.hasPlacedFirstCard = true;
                        this.startCountdown(10);
                    }
                }
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

    private checkOmniMerge(targetRow: number, targetCol: number) {
        const fullLines = [
            this.defenseGrid[targetRow].map((_, c) => ({ r: targetRow, c })),
            this.defenseGrid.map((_, r) => ({ r, c: targetCol }))
        ];
        const d1 = []; let r = targetRow, c = targetCol;
        while (r > 0 && c > 0) { r--; c--; }
        while (r < 5 && c < 4) { d1.push({ r: r++, c: c++ }); }
        if (d1.length >= 3) fullLines.push(d1);
        const d2 = []; r = targetRow; c = targetCol;
        while (r > 0 && c < 3) { r--; c++; }
        while (r < 5 && c >= 0) { d2.push({ r: r++, c: c-- }); }
        if (d2.length >= 3) fullLines.push(d2);

        for (const line of fullLines) {
            let segments: any[][] = [];
            let currentSegment: any[] = [];
            for (const pos of line) {
                const card = this.defenseGrid[pos.r][pos.c];
                if (card) currentSegment.push({ ...pos, card });
                else { if (currentSegment.length > 0) segments.push(currentSegment); currentSegment = []; }
            }
            if (currentSegment.length > 0) segments.push(currentSegment);
            const activeSegment = segments.find(seg => seg.some(item => item.r === targetRow && item.c === targetCol));
            if (activeSegment && activeSegment.length >= 3) {
                const hand = this.evaluateHand(activeSegment.map(item => item.card));
                if (hand.rank >= 2) { this.executeMerge(activeSegment, { r: targetRow, c: targetCol }, hand); break; }
            }
        }
    }

    private evaluateHand(cards: any[]) {
        const valuesRaw = cards.map(c => this.VALUES.indexOf(c.value));
        const suits = cards.map(c => c.suit);
        const count = cards.length;
        const isFlush = new Set(suits).size === 1;
        const checkStrictStraight = (pts: number[]) => {
            if (pts.length < 3) return false;
            const sorted = pts.slice().sort((a, b) => a - b);
            if (new Set(sorted).size !== count) return false;
            return (sorted[sorted.length - 1] - sorted[0] === count - 1);
        };
        const ptsLow = valuesRaw.map(v => v);
        const ptsHigh = valuesRaw.map(v => v === 0 ? 13 : v);
        const isStraight = checkStrictStraight(ptsLow) || checkStrictStraight(ptsHigh);
        const isAllSame = new Set(valuesRaw).size === 1;
        if (isFlush && isStraight) return { name: '同花顺', rank: 5, levelBonus: count * 1.5 };
        if (isAllSame && count >= 4) return { name: '四条', rank: 4.5, levelBonus: count * 1.2 };
        if (isAllSame && count === 3) return { name: '三条', rank: 3.5, levelBonus: count };
        if (isFlush) return { name: '同花', rank: 2.8, levelBonus: count * 0.8 };
        if (isStraight) return { name: '顺子', rank: 2.5, levelBonus: count * 0.8 };
        if (isAllSame && count === 2) return { name: '对子', rank: 1.5, levelBonus: 1 };
        return { name: '单张', rank: 0, levelBonus: 0 };
    }

    private executeMerge(items: any[], targetPos: { r: number, c: number }, hand: any) {
        let totalLevel = 0, totalCards = 0;
        const cellWidth = this.GAME_WIDTH / 4, cellHeight = this.DEF_HEIGHT / 5;
        items.forEach(item => {
            totalLevel += item.card.level;
            totalCards += (item.card.cardCount || 1);
            if (item.r !== targetPos.r || item.c !== targetPos.c) {
                this.defenseGrid[item.r][item.c] = null;
                this.burstParticles(item.c * cellWidth + cellWidth / 2, this.DEF_START_Y + item.r * cellHeight + cellHeight / 2, '#ffffff', 5);
            }
        });
        const targetCard = this.defenseGrid[targetPos.r][targetPos.c];
        if (targetCard) {
            targetCard.level = Math.floor(totalLevel + hand.levelBonus);
            targetCard.handName = hand.name;
            targetCard.cardCount = totalCards;
            this.playSound(1400, 'sine', 0.3, 0.4);
            this.burstParticles(targetPos.c * cellWidth + cellWidth / 2, this.DEF_START_Y + targetPos.r * cellHeight + cellHeight / 2, '#f1c40f', 20);
        }
    }

    private gameLoop = (_timestamp: number) => {
        this.update();
        this.render();
        requestAnimationFrame(this.gameLoop);
    };

    private update() {
        if (this.gameOver) return;
        const now = Date.now();

        // 状态变化检测 (用于徽章 POP 动画)
        if (this.hp !== this.prevHp) { this.hpPopTimer = 15; this.prevHp = this.hp; }
        if (this.gold !== this.prevGold) { this.goldPopTimer = 15; this.prevGold = this.gold; }
        const currentDeckSize = this.deck.length + this.cards.filter(c => c !== null).length;
        if (currentDeckSize !== this.prevDeckSize) { this.deckPopTimer = 15; this.prevDeckSize = currentDeckSize; }

        if (this.hpPopTimer > 0) this.hpPopTimer--;
        if (this.goldPopTimer > 0) this.goldPopTimer--;
        if (this.deckPopTimer > 0) this.deckPopTimer--;

        if (this.hoveredTower && this.tooltipTimer < 15) {
            this.tooltipTimer++;
        }

        // 爆炸效果逻辑
        for (let i = this.boomEffects.length - 1; i >= 0; i--) {
            this.boomEffects[i].progress += 0.025;
            if (this.boomEffects[i].progress >= 1) {
                this.boomEffects.splice(i, 1);
            }
        }

        if (this.isCountdownActive) {
            if (now - this.lastCountdownSnapshot >= 1000) {
                this.countdownSeconds--;
                this.lastCountdownSnapshot = now;
                if (this.countdownSeconds <= 0) {
                    this.isCountdownActive = false;
                    this.startNextWave();
                }
            }
        }

        if (this.remainingToSpawn > 0 && now - this.lastSpawnTime > 700 / Math.pow(this.difficultyFactor, 0.2)) {
            const baseHp = 6 + this.wave * 2;
            this.enemies.push({
                t: 0, hp: baseHp * this.difficultyFactor, maxHp: baseHp * this.difficultyFactor,
                speed: (0.0016 + Math.random() * 0.0006) * Math.pow(this.difficultyFactor, 0.1)
            });
            this.remainingToSpawn--;
            this.lastSpawnTime = now;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.t += enemy.speed;
            if (enemy.t >= 1) {
                this.enemies.splice(i, 1);
                this.hp--;
                this.playSound(150, 'sawtooth', 0.3, 0.2);
                if (this.hp <= 0) {
                    this.hp = 0; this.gameOver = true;
                    this.playSound(100, 'sawtooth', 0.6, 0.3);
                }
                continue;
            }
            const pos = this.getPathPos(enemy.t);
            enemy.x = pos.x; enemy.y = pos.y;
        }

        if (this.hasPlacedFirstCard && this.wave > 0 && this.remainingToSpawn === 0 && this.enemies.length === 0 && !this.isCountdownActive) {
            const avgT = this.waveEnemiesKilled > 0 ? (this.waveKillDistSum / this.waveEnemiesKilled) : 1;
            const restTime = 25 - (avgT * 15);
            this.startCountdown(restTime);
        }

        const cellWidth = this.GAME_WIDTH / 4, cellHeight = this.DEF_HEIGHT / 5;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const tower = this.defenseGrid[r][c];
                if (!tower) continue;
                const tx = c * cellWidth + cellWidth / 2, ty = this.DEF_START_Y + r * cellHeight + cellHeight / 2;
                const towerId = `${r}-${c}`;
                let speedMul = 1, damageMul = 1;
                if (tower.handName === '对子') speedMul = 1.6;
                else if (tower.handName === '三条') damageMul = 2.2;
                else if (tower.handName === '同花') speedMul = 2.5;
                else if (tower.handName === '顺子') damageMul = 3.5;
                else if (tower.handName === '同花顺') { speedMul = 2.5; damageMul = 4; }

                if (now - (this.towerCooldowns.get(towerId) || 0) > 800 / speedMul) {
                    let closestEnemy = null, minDist = 135 + (tower.level * 4) + ((tower.cardCount || 1) * 35);
                    for (const enemy of this.enemies) {
                        const dist = Math.sqrt((enemy.x - tx) ** 2 + (enemy.y - ty) ** 2);
                        if (dist < minDist) { minDist = dist; closestEnemy = enemy; }
                    }
                    if (closestEnemy) {
                        this.projectiles.push({ x: tx, y: ty, target: closestEnemy, speed: 6.8, damage: (2 + tower.level) * damageMul });
                        this.towerCooldowns.set(towerId, now);
                        this.playSound(800 + tower.level * 100, 'square', 0.05, 0.03);
                    }
                }
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 10) {
                p.target.hp -= p.damage;
                if (p.target.hp <= 0) {
                    this.addBoom(p.target.x, p.target.y, 'BOOM!', Math.random() > 0.5 ? '#FFEA00' : '#FF007F');
                    const idx = this.enemies.indexOf(p.target);
                    if (idx !== -1) {
                        this.waveKillDistSum += p.target.t; this.waveEnemiesKilled++;
                        for (let k = 0; k < 8; k++) this.particles.push({ x: p.target.x, y: p.target.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 30, color: '#ff4444' });
                        this.enemies.splice(idx, 1);
                        this.gold += 3;
                        this.playSound(1200, 'sine', 0.05, 0.05);
                    }
                }
                this.projectiles.splice(i, 1);
            } else { p.x += (dx / dist) * p.speed; p.y += (dy / dist) * p.speed; }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i]; part.x += part.vx; part.y += part.vy; part.life--;
            if (part.life <= 0) this.particles.splice(i, 1);
        }
    }

    private getPathPos(t: number) {
        const pathArea = LAYOUT.AREAS.PATH;
        const transArea = LAYOUT.AREAS.TRANSITION;
        const top = pathArea.startY;
        const bottom = transArea.startY + transArea.height;
        const left = 20, right = this.GAME_WIDTH - 20;

        if (t < 0.25) return { x: left + (t / 0.25) * (right - left), y: top };
        else if (t < 0.5) return { x: right, y: top + ((t - 0.25) / 0.25) * (bottom - top) };
        else if (t < 0.75) return { x: right - ((t - 0.5) / 0.25) * (right - left), y: bottom };
        else return { x: left, y: bottom - ((t - 0.75) / 0.25) * (bottom - top) };
    }

    private render() {
        const renderState: RenderState = {
            hp: this.hp,
            gold: this.gold,
            wave: this.wave,
            deckSize: this.deck.length + this.cards.filter(c => c !== null).length,
            cards: this.cards,
            defenseGrid: this.defenseGrid,
            draggingIndex: this.draggingIndex,
            dragPos: this.dragPos,
            hoverIndex: this.hoverIndex,
            hoveredButton: this.hoveredButton,
            pressedButton: this.pressedButton,
            hasPlacedFirstCard: this.hasPlacedFirstCard,
            gameOver: this.gameOver,
            hpPopTimer: this.hpPopTimer,
            goldPopTimer: this.goldPopTimer,
            deckPopTimer: this.deckPopTimer,
            tooltipTimer: this.tooltipTimer,
            hoveredTower: this.hoveredTower,
            enemies: this.enemies,
            projectiles: this.projectiles,
            particles: this.particles,
            boomEffects: this.boomEffects,
            difficultyFactor: this.difficultyFactor,
            isCountdownActive: this.isCountdownActive,
            countdownSeconds: this.countdownSeconds,
            noticeAsset: this.noticeAsset
        };

        this.renderer.render(renderState);
    }



    private addBoom(x: number, y: number, text: string, color: string) {
        this.boomEffects.push({ x, y, text, progress: 0, color });
    }

}
