export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    
    private readonly GAME_WIDTH = 450;
    private readonly GAME_HEIGHT = 800;

    private hp: number = 3;
    private wave: number = 1;
    private gold: number = 10;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.canvas.width = this.GAME_WIDTH;
        this.canvas.height = this.GAME_HEIGHT;
        requestAnimationFrame(this.gameLoop);
    }

    private gameLoop = (timestamp: number) => {
        this.update();
        this.render();
        requestAnimationFrame(this.gameLoop);
    };

    private update() { }

    private render() {
        this.ctx.fillStyle = '#2c2c2e';
        this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        this.drawTopBar();
        this.drawCombatArea();
        this.drawDefenseArea();
        this.drawOperationArea();
    }

    private drawTopBar() {
        this.ctx.fillStyle = '#1c1c1e';
        this.ctx.fillRect(0, 0, this.GAME_WIDTH, 40);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '18px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`❤️ HP: ${this.hp}`, 15, 26);
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Wave: ${this.wave}`, this.GAME_WIDTH / 2, 26);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`💰 Gold: ${this.gold}`, this.GAME_WIDTH - 15, 26);
    }

    private drawCombatArea() {
        const combatHeight = 320;
        const startY = 40;
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, startY + combatHeight);
        this.ctx.lineTo(this.GAME_WIDTH, startY + combatHeight);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(50, startY + 20);
        this.ctx.bezierCurveTo(250, startY + 20, 350, startY + 150, 225, startY + 150);
        this.ctx.bezierCurveTo(100, startY + 150, 50, startY + 280, 200, startY + 280);
        this.ctx.lineTo(this.GAME_WIDTH + 20, startY + 280);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = '#ff4444';
        this.ctx.beginPath();
        this.ctx.arc(this.GAME_WIDTH - 40, startY + 280, 20, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private drawDefenseArea() {
        const startY = 360;
        const gridHeight = 300;
        const cols = 4;
        const rows = 5;
        const cellWidth = this.GAME_WIDTH / cols;
        const cellHeight = gridHeight / rows;

        this.ctx.strokeStyle = '#3a3a3c';
        this.ctx.lineWidth = 1;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * cellWidth;
                const y = startY + r * cellHeight;
                this.ctx.strokeRect(x, y, cellWidth, cellHeight);
                this.ctx.fillStyle = '#444';
                this.ctx.fillRect(x + cellWidth / 2 - 2, y + cellHeight / 2 - 2, 4, 4);
            }
        }
    }

    private drawOperationArea() {
        const startY = 660;
        const cardWidth = 60;
        const cardHeight = 85;
        const gap = 20;
        const cardsStartX = (this.GAME_WIDTH - (cardWidth * 3 + gap * 2)) / 2;

        for (let i = 0; i < 3; i++) {
            const cx = cardsStartX + i * (cardWidth + gap);
            const cy = startY + 10;
            const mockCards = [
                { suit: '♠', value: 'A' },
                { suit: '♥', value: 'K' },
                { suit: '♣', value: '7' }
            ];
            this.drawCard(this.ctx, cx, cy, mockCards[i].suit, mockCards[i].value, cardWidth, cardHeight);
        }

        const btnY = startY + 105;
        this.drawButton(50, btnY, 150, 35, '🔄 刷新 (5G)', '#444');
        this.drawButton(this.GAME_WIDTH - 200, btnY, 150, 35, '▶ 下一波', '#28a745');
    }

    public drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, suit: string, value: string, width: number = 60, height: number = 85) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 6);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        const isRed = suit === '♥' || suit === '♦';
        ctx.fillStyle = isRed ? '#d32f2f' : '#000000';

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 16px Courier New';
        ctx.fillText(value, x + 5, y + 5);
        ctx.font = '14px Courier New';
        ctx.fillText(suit, x + 5, y + 22);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '30px Courier New';
        ctx.fillText(suit, x + width / 2, y + height / 2 + 5);
    }

    private drawButton(x: number, y: number, w: number, h: number, text: string, color: string) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 8);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '14px Courier New';
        this.ctx.fillText(text, x + w / 2, y + h / 2);
    }
}
