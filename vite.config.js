import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 是"打包+开发服务器"工具，这个文件告诉它怎么处理 React
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,          // 固定端口，方便你记住预览地址
    open: false          // 不自动开浏览器（避免吓到你），你手动打开
  }
})