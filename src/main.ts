import { Game } from './core/Game'; // 引入我们在提示词 1 中写好的核心类

class App {
    private canvas: HTMLCanvasElement;
    private audioUnlocked: boolean = false;

    // 内部逻辑分辨率
    private readonly GAME_WIDTH = 450;
    private readonly GAME_HEIGHT = 800;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

        // 1. 初始化屏幕适配
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // 2. 绑定 Web Audio 激活事件 (必须由用户真实的 Touch 或 Click 触发)
        const unlockAudio = () => {
            if (this.audioUnlocked) return;
            this.initAudioContext();
            this.audioUnlocked = true;
            // 触发一次后即可移除监听
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };
        document.addEventListener('touchstart', unlockAudio, { once: true });
        document.addEventListener('click', unlockAudio, { once: true });

        // 3. 模拟资源加载并启动游戏
        this.loadGame();
    }

    /**
     * 屏幕等比例缩放自适应逻辑 (保持 9:16，在各类异形屏下居中显示，两边留黑)
     */
    private resize() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 计算缩放比例 (取宽缩放和高缩放中较小的一个，确保画面完全显示在屏幕内)
        const scale = Math.min(windowWidth / this.GAME_WIDTH, windowHeight / this.GAME_HEIGHT);

        // 使用 CSS 硬件加速进行缩放，不改变 Canvas 内部渲染像素，保证极佳性能
        this.canvas.style.width = `${this.GAME_WIDTH * scale}px`;
        this.canvas.style.height = `${this.GAME_HEIGHT * scale}px`;
    }

    /**
     * 解锁浏览器 Web Audio 限制
     */
    private initAudioContext() {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            // 创建一个极短的静音 Buffer 并播放，借此激活系统底层的音频通道
            const buffer = ctx.createBuffer(1, 1, 22050);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);

            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            console.log("🎵 Web Audio Context 激活成功！");
        }
    }

    /**
     * 加载流程与启动
     */
    private async loadGame() {
        const loadingText = document.getElementById('loading-text');

        // 模拟资源加载耗时 (如果你有图片/音频资源，应在此处使用 Promise.all 加载)
        if (loadingText) loadingText.innerText = "初始化引擎...";
        await new Promise(resolve => setTimeout(resolve, 800));

        // 启动核心游戏循环
        new Game('gameCanvas');

        // 淡出并移除 Loading 界面
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        console.log("🚀 游戏启动完成！");
    }
}

// 页面加载完成后立即启动执行
window.onload = () => {
    new App();
};