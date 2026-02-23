export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

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

    private readonly DEF_START_Y = 240;
    private readonly DEF_HEIGHT = 300;
    private readonly OP_START_Y = 660;

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

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.canvas.width = this.GAME_WIDTH;
        this.canvas.height = this.GAME_HEIGHT;

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

        this.initDeck();
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
                this.resetGame();
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
        if (this.gameOver || this.draggingIndex === -1) return;
        this.dragPos = this.getMousePos(e);
    };

    private handleEnd = (e: MouseEvent) => {
        if (this.gameOver || this.draggingIndex === -1) return;
        const pos = this.getMousePos(e);
        const { x, y } = pos;

        const cellWidth = this.GAME_WIDTH / 4, cellHeight = this.DEF_HEIGHT / 5;

        if (y >= this.DEF_START_Y && y <= this.DEF_START_Y + this.DEF_HEIGHT) {
            const col = Math.floor(x / cellWidth);
            const row = Math.floor((y - this.DEF_START_Y) / cellHeight);

            if (row >= 0 && row < 5 && col >= 0 && col < 4) {
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
                    this.burstParticles(col * cellWidth + cellWidth / 2, this.DEF_START_Y + row * cellHeight + cellHeight / 2, '#f1c40f');
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
        const top = 180, bottom = 600, left = 20, right = this.GAME_WIDTH - 20;
        if (t < 0.25) return { x: left + (t / 0.25) * (right - left), y: top };
        else if (t < 0.5) return { x: right, y: top + ((t - 0.25) / 0.25) * (bottom - top) };
        else if (t < 0.75) return { x: right - ((t - 0.5) / 0.25) * (right - left), y: bottom };
        else return { x: left, y: bottom - ((t - 0.75) / 0.25) * (bottom - 180 + 100) };
    }

    private render() {
        this.ctx.fillStyle = '#1c1c1e';
        this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        this.drawPathBg();
        this.drawTopBar();
        this.drawDefenseArea();
        this.drawEntities();
        this.drawOperationArea();

        if (!this.hasPlacedFirstCard && !this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(0, 180, this.GAME_WIDTH, 420);
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = 'bold 20px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('放置第一张牌以开始', this.GAME_WIDTH / 2, 400);
        }

        if (this.gameOver) { this.drawGameOver(); }
        else if (this.difficultyFactor > 2) { this.ctx.strokeStyle = '#ff000022'; this.ctx.lineWidth = 4; this.ctx.strokeRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT); }
    }

    private drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        this.ctx.fillStyle = '#e74c3c'; this.ctx.font = 'bold 42px Courier New'; this.ctx.textAlign = 'center'; this.ctx.fillText('GAME OVER', this.GAME_WIDTH / 2, 320);
        this.ctx.fillStyle = '#ffffff'; this.ctx.font = '20px Courier New'; this.ctx.fillText(`最终波次: ${this.wave}`, this.GAME_WIDTH / 2, 380);
        this.ctx.fillText(`剩余金币: ${this.gold}G`, this.GAME_WIDTH / 2, 410);
        this.drawButton(this.GAME_WIDTH / 2 - 100, 450, 200, 50, '重新开始', '#27ae60');
    }

    private drawPathBg() {
        const top = 180, bottom = 600, left = 20, right = this.GAME_WIDTH - 20;
        this.ctx.strokeStyle = '#2c2c2e'; this.ctx.lineWidth = 30; this.ctx.lineJoin = 'round';
        this.ctx.beginPath(); this.ctx.moveTo(left, top); this.ctx.lineTo(right, top); this.ctx.lineTo(right, bottom); this.ctx.lineTo(left, bottom); this.ctx.lineTo(left, top); this.ctx.stroke();
    }

    private drawTopBar() {
        this.ctx.fillStyle = '#0a0a0acc'; this.ctx.fillRect(0, 0, this.GAME_WIDTH, 48);
        this.ctx.fillStyle = '#eee'; this.ctx.font = 'bold 14px Courier New';
        this.ctx.textAlign = 'left'; this.ctx.fillText(`生命:${this.hp}`, 12, 28);
        this.ctx.textAlign = 'center';
        const totalCardsInDeck = this.deck.length + this.cards.filter(c => c !== null).length;
        const deckColor = totalCardsInDeck < 10 ? '#ff4444' : '#fff';
        this.ctx.fillStyle = deckColor; this.ctx.fillText(`余牌:${totalCardsInDeck}`, this.GAME_WIDTH / 2, 28);
        this.ctx.fillStyle = '#eee'; this.ctx.textAlign = 'right'; this.ctx.fillText(`金币:${this.gold}`, this.GAME_WIDTH - 12, 28);
    }

    private drawDefenseArea() {
        const cellWidth = this.GAME_WIDTH / 4, cellHeight = this.DEF_HEIGHT / 5;
        this.ctx.strokeStyle = '#333'; this.ctx.lineWidth = 1;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const x = c * cellWidth, y = this.DEF_START_Y + r * cellHeight;
                this.ctx.strokeRect(x, y, cellWidth, cellHeight);
                const tower = this.defenseGrid[r][c];
                if (tower) {
                    this.drawCard(this.ctx, x + 5, y + 5, tower.suit, tower.value, cellWidth - 10, cellHeight - 10, 10);
                    if (tower.handName) { this.ctx.fillStyle = '#f1c40f'; this.ctx.font = 'bold 9px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText(tower.handName, x + cellWidth / 2, y + cellHeight - 6); }
                    if (tower.level > 1) { this.ctx.fillStyle = '#1c1c1e'; this.ctx.globalAlpha = 0.8; this.ctx.fillRect(x + cellWidth - 30, y + 5, 25, 11); this.ctx.globalAlpha = 1.0; this.ctx.fillStyle = '#f1c40f'; this.ctx.font = 'bold 9px Arial'; this.ctx.textAlign = 'right'; this.ctx.fillText(`L${tower.level}`, x + cellWidth - 8, y + 14); }
                }
            }
        }
    }

    private drawEntities() {
        for (const enemy of this.enemies) {
            this.ctx.fillStyle = '#ff4444'; this.ctx.beginPath(); this.ctx.arc(enemy.x, enemy.y, 11, 0, Math.PI * 2); this.ctx.fill();
            const hpWidth = 26; this.ctx.fillStyle = '#440000'; this.ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 20, hpWidth, 4);
            this.ctx.fillStyle = '#00ff00'; this.ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 20, hpWidth * (enemy.hp / enemy.maxHp), 4);
        }
        for (const p of this.projectiles) { this.ctx.fillStyle = '#f1c40f'; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); this.ctx.fill(); }
        for (const part of this.particles) { this.ctx.fillStyle = part.color; this.ctx.globalAlpha = part.life / 40; this.ctx.fillRect(part.x, part.y, 3, 3); this.ctx.globalAlpha = 1.0; }
    }

    private drawOperationArea() {
        const cardWidth = 66, cardHeight = 92, gap = 20;
        const xOffset = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;
        this.ctx.fillStyle = '#111'; this.ctx.fillRect(0, this.OP_START_Y, this.GAME_WIDTH, this.GAME_HEIGHT - this.OP_START_Y);
        for (let i = 0; i < 3; i++) {
            const card = this.cards[i];
            const cx = xOffset + i * (cardWidth + gap), cy = this.OP_START_Y + 10;
            if (card && this.draggingIndex !== i) this.drawCard(this.ctx, cx, cy, card.suit, card.value, cardWidth, cardHeight);
            else if (!card) { this.ctx.strokeStyle = '#222'; this.ctx.strokeRect(cx, cy, cardWidth, cardHeight); }
        }
        if (this.draggingIndex !== -1 && this.dragPos) {
            const card = this.cards[this.draggingIndex]!;
            this.drawCard(this.ctx, this.dragPos.x - 33, this.dragPos.y - 46, card.suit, card.value, 66, 92);
        }
        const btnY = this.OP_START_Y + 105;
        this.drawButton(50, btnY, 150, 38, `🔄 刷新 (${this.refreshCost}G)`, this.pressedButton === 'refresh' ? '#f1c40f' : '#333');
        let nextWaveText = this.hasPlacedFirstCard ? '▶ 下一波' : '⏳ 准备中';
        if (this.isCountdownActive) nextWaveText = `⌛ 自动开始 (${this.countdownSeconds}s)`;
        this.drawButton(this.GAME_WIDTH - 200, btnY, 150, 38, nextWaveText, this.pressedButton === 'next_wave' ? '#f39c12' : (this.hasPlacedFirstCard ? '#27ae60' : '#555'));
    }

    public drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, suit: string, value: string, width: number, height: number, fontSize: number = 20) {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x, y, width, height, 8); ctx.fill();
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
        const isRed = suit === '♥' || suit === '♦'; ctx.fillStyle = isRed ? '#d32f2f' : '#000000'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `bold ${fontSize}px Courier New`;
        ctx.fillText(value, x + width * 0.1, y + height * 0.08); ctx.font = `${fontSize * 0.8}px Courier New`; ctx.fillText(suit, x + width * 0.1, y + height * 0.3);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${fontSize * 2.2}px Courier New`; ctx.fillText(suit, x + width / 2, y + height / 2 + 7);
    }

    private drawButton(x: number, y: number, w: number, h: number, text: string, color: string) {
        this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.roundRect(x, y, w, h, 10); this.ctx.fill();
        this.ctx.fillStyle = '#ffffff'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle'; this.ctx.font = 'bold 11px Courier New';
        this.ctx.fillText(text, x + w / 2, y + h / 2);
    }
}
