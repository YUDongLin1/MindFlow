import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10))
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
      },
    },
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['vue', 'pinia', 'vuex', 'vue-router'],
          editor: ['@tiptap/vue-3', '@tiptap/starter-kit'],
          utils: ['localforage', 'dompurify'],
          icons: ['lucide-vue-next']
        }
      },
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    host: 'localhost',
    port: 3000,
    watch: {
      ignored: ['**/dist-electron/**', '**/dist_old_*/**', '**/node_modules/**', '**/dist/**']
    }
  },
  optimizeDeps: {
    include: ['vue', 'pinia', 'vuex', 'vue-router', '@tiptap/vue-3', '@tiptap/starter-kit', 'localforage', 'dompurify']
  }
})
