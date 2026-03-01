export interface GameEvent {
    type: 'sound' | 'effect' | 'state_change';
    name: string;
    params?: any;
}

export class GameEngine {
    public hp: number = 3;
    public gold: number = 10;
    public wave: number = 0;
    public gameOver: boolean = false;
    public hasPlacedFirstCard: boolean = false;

    public cards: ({ suit: string, value: string } | null)[] = [];
    public defenseGrid: ({ suit: string, value: string, level: number, handName?: string, cardCount?: number } | null)[][] = [];
    public deck: { suit: string, value: string }[] = [];

    public refreshCost: number = 5;
    public countdownSeconds: number = 0;
    public isCountdownActive: boolean = false;

    public difficultyFactor: number = 1.0;
    public enemies: any[] = [];
    public projectiles: any[] = [];

    // Internal logic state
    private lastCountdownSnapshot: number = 0;
    private lastSpawnTime: number = 0;
    private remainingToSpawn: number = 0;
    private waveKillDistSum: number = 0;
    private waveEnemiesKilled: number = 0;
    private towerCooldowns: Map<string, number> = new Map();

    private readonly SUITS = ['♠', '♥', '♣', '♦'];
    private readonly VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // Event listener for side effects
    private onEvent: (event: GameEvent) => void;

    constructor(onEvent: (event: GameEvent) => void) {
        this.onEvent = onEvent;
        this.reset();
    }

    public reset() {
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

    public refreshCards() {
        for (let i = 0; i < 3; i++) {
            if (!this.cards[i] && this.deck.length > 0) {
                this.cards[i] = this.deck.pop() || null;
            }
        }
    }

    public forceRefreshCards() {
        for (let i = 0; i < 3; i++) {
            if (this.cards[i]) {
                this.deck.push(this.cards[i]!);
                this.cards[i] = null;
            }
        }
        this.shuffleDeck();
        this.refreshCards();
    }

    public handleReroll() {
        if (this.gold >= this.refreshCost) {
            this.gold -= this.refreshCost;
            this.forceRefreshCards();
            const calculatedCost = Math.floor(this.gold * 0.4);
            if (calculatedCost > this.refreshCost) this.refreshCost = calculatedCost;

            this.onEvent({ type: 'sound', name: 'reroll', params: { freq: 500 } });
            return true;
        }
        return false;
    }

    public startNextWave() {
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

        this.onEvent({ type: 'sound', name: 'next_wave', params: { freq: 440, type: 'triangle' } });
    }

    public startCountdown(duration: number) {
        this.countdownSeconds = Math.max(10, Math.min(25, Math.ceil(duration)));
        this.isCountdownActive = true;
        this.lastCountdownSnapshot = Date.now();
    }

    public placeCard(draggingIndex: number, row: number, col: number) {
        const card = this.cards[draggingIndex];
        if (!card) return false;

        const existing = this.defenseGrid[row][col];
        if (!existing) {
            this.defenseGrid[row][col] = { ...card, level: 1, cardCount: 1 };
            this.cards[draggingIndex] = null;
            this.onEvent({ type: 'sound', name: 'place', params: { freq: 660 } });
            this.checkOmniMerge(row, col);
            this.refreshCards();
            this.handleFirstPlacement();
            return true;
        } else if (existing.suit === card.suit && existing.value === card.value) {
            existing.level++;
            existing.cardCount = (existing.cardCount || 1) + 1;
            this.cards[draggingIndex] = null;
            this.onEvent({ type: 'sound', name: 'merge', params: { freq: 880 } });
            this.onEvent({ type: 'effect', name: 'burst', params: { r: row, c: col, color: '#f1c40f' } });
            this.checkOmniMerge(row, col);
            this.refreshCards();
            this.handleFirstPlacement();
            return true;
        }
        return false;
    }

    private handleFirstPlacement() {
        if (!this.hasPlacedFirstCard) {
            this.hasPlacedFirstCard = true;
            this.startCountdown(10);
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
        items.forEach(item => {
            totalLevel += item.card.level;
            totalCards += (item.card.cardCount || 1);
            if (item.r !== targetPos.r || item.c !== targetPos.c) {
                this.defenseGrid[item.r][item.c] = null;
                this.onEvent({ type: 'effect', name: 'burst', params: { r: item.r, c: item.c, color: '#ffffff', count: 5 } });
            }
        });
        const targetCard = this.defenseGrid[targetPos.r][targetPos.c];
        if (targetCard) {
            targetCard.level = Math.floor(totalLevel + hand.levelBonus);
            targetCard.handName = hand.name;
            targetCard.cardCount = totalCards;

            this.onEvent({ type: 'sound', name: 'omni_merge', params: { freq: 1400, duration: 0.3, volume: 0.4 } });
            this.onEvent({ type: 'effect', name: 'burst', params: { r: targetPos.r, c: targetPos.c, color: '#f1c40f', count: 20 } });
        }
    }

    public update(now: number) {
        if (this.gameOver) return;

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
                this.onEvent({ type: 'sound', name: 'damage', params: { freq: 150, type: 'sawtooth', duration: 0.3, volume: 0.2 } });
                if (this.hp <= 0) {
                    this.hp = 0; this.gameOver = true;
                    this.onEvent({ type: 'sound', name: 'game_over', params: { freq: 100, type: 'sawtooth', duration: 0.6, volume: 0.3 } });
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

        this.updateTowers(now);
        this.updateProjectiles();
    }

    private updateTowers(now: number) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const tower = this.defenseGrid[r][c];
                if (!tower) continue;
                const towerId = `${r}-${c}`;
                let speedMul = 1, damageMul = 1;
                if (tower.handName === '对子') speedMul = 1.6;
                else if (tower.handName === '三条') damageMul = 2.2;
                else if (tower.handName === '同花') speedMul = 2.5;
                else if (tower.handName === '顺子') damageMul = 3.5;
                else if (tower.handName === '同花顺') { speedMul = 2.5; damageMul = 4; }

                if (now - (this.towerCooldowns.get(towerId) || 0) > 800 / speedMul) {
                    let closestEnemy = null, minDist = 135 + (tower.level * 4) + ((tower.cardCount || 1) * 35);
                    const tx = c * (450 / 4) + (450 / 8); // Approximate, engine doesn't need pixel perfect but here for logic
                    const ty = 413 + r * (255 / 5) + (255 / 10); // Approximate based on LAYOUT

                    for (const enemy of this.enemies) {
                        const dist = Math.sqrt((enemy.x - tx) ** 2 + (enemy.y - ty) ** 2);
                        if (dist < minDist) { minDist = dist; closestEnemy = enemy; }
                    }
                    if (closestEnemy) {
                        this.projectiles.push({ r, c, target: closestEnemy, speed: 6.8, damage: (2 + tower.level) * damageMul });
                        this.towerCooldowns.set(towerId, now);
                        this.onEvent({ type: 'sound', name: 'shoot', params: { freq: 800 + tower.level * 100, type: 'square', duration: 0.05, volume: 0.03 } });
                    }
                }
            }
        }
    }

    private updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            // Calculate pixel positions for distance check
            // Note: In a true separate backend, we'd use grid coords or a separate physics space.
            // For now, we continue using approximated pixels to match current logic.
            const tx = p.c * (450 / 4) + (450 / 8);
            const ty = 413 + p.r * (255 / 5) + (255 / 10);

            if (!p.x) { p.x = tx; p.y = ty; }

            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                p.target.hp -= p.damage;
                if (p.target.hp <= 0) {
                    this.onEvent({ type: 'effect', name: 'boom', params: { x: p.target.x, y: p.target.y } });
                    const idx = this.enemies.indexOf(p.target);
                    if (idx !== -1) {
                        this.waveKillDistSum += p.target.t; this.waveEnemiesKilled++;
                        this.onEvent({ type: 'effect', name: 'burst', params: { x: p.target.x, y: p.target.y, color: '#ff4444', count: 8 } });
                        this.enemies.splice(idx, 1);
                        this.gold += 3;
                        this.onEvent({ type: 'sound', name: 'kill', params: { freq: 1200 } });
                    }
                }
                this.projectiles.splice(i, 1);
            } else { p.x += (dx / dist) * p.speed; p.y += (dy / dist) * p.speed; }
        }
    }

    private getPathPos(t: number) {
        // Path logic duplicated here to keep Engine pure and independent of LAYOUT imports if needed
        // These values match LAYOUT.AREAS.PATH and TRANSITION
        const top = 110; // NOTICE height (80) + STATUS_BAR height (30)
        const bottom = 413; // PATH height (278) + top (110) + TRANSITION height (25)
        const left = 20, right = 430; // 450 - 20

        if (t < 0.25) return { x: left + (t / 0.25) * (right - left), y: top };
        else if (t < 0.5) return { x: right, y: top + ((t - 0.25) / 0.25) * (bottom - top) };
        else if (t < 0.75) return { x: right - ((t - 0.5) / 0.25) * (right - left), y: bottom };
        else return { x: left, y: bottom - ((t - 0.75) / 0.25) * (bottom - top) };
    }
}
