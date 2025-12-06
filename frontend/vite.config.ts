/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), // Enables React Fast Refresh and JSX transformation
    tsconfigPaths(), // Resolves TypeScript path aliases from tsconfig.json
  ],
  
  server: {
    port: 3000, // Match CRA's default port
    host: '0.0.0.0', // Listen on all network interfaces (required for Docker)
    open: false, // Don't auto-open browser (doesn't work in Docker)
    strictPort: true, // Fail if port is already in use
  },
  
  build: {
    outDir: 'build', // Match CRA's output directory
    sourcemap: true, // Enable source maps for debugging
  },
  
  // Handle public directory assets
  publicDir: 'public',
  
  // Test configuration for Vitest
  test: {
    globals: true, // Enables global test, describe, it, expect, etc.
    environment: 'jsdom', // Browser-like environment for React testing
    setupFiles: './src/setupTests.ts',
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    css: true, // Process CSS files
    // Vitest natively supports ESM, so no transformIgnorePatterns needed!
  },
})
