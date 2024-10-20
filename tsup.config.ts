import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  // dts: true,
  clean: true,
  target: ['es2021'],
  format: ['cjs'],
  outDir: 'dist',
  sourcemap: false
})
