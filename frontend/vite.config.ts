import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 相对路径：构建产物可直接部署到 GitHub Pages 等任意静态托管
  base: './',
  build: {
    // 关闭代码分包：配合 scripts/inline_build.py 产出单文件 index.html，
    // 使产物双击（file:// 协议）也能在浏览器打开（外链 module 脚本在 file:// 下会被 CORS 拦截）
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
