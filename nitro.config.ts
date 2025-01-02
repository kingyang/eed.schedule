// https://nitro.unjs.io/config

export default defineNitroConfig({
  compatibilityDate: '2025-01-02',
  noPublicDir: true,
  minify: process.env.NODE_ENV === 'production',
  sourceMap: process.env.NODE_ENV !== 'production',
  srcDir: 'server',
  watchOptions: {
    cwd: '.',
    ignored: ['**/node_modules/**', '**/.git/**', '**/.nitro/**', '**/data/**'],
  },
})
