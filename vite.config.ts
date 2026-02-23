import { defineConfig } from 'vite';

export default defineConfig({
  // 【关键】确保打包后的资源全部使用相对路径！适用于 TapTap 离线包和各类 H5 托管
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets', // 编译后的 JS/CSS 存放目录
    target: 'es2015',    // 兼容老旧手机浏览器
    minify: 'terser',    // 使用 terser 进行更深度的压缩
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境自动去除 console.log 提升性能
        drop_debugger: true
      }
    }
  },
  server: {
    host: '0.0.0.0', // 允许手机在局域网下通过 IP 访问测试
    port: 3000
  }
});