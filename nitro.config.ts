// https://nitro.unjs.io/config
export default defineNitroConfig({
  compatibilityDate: '2025-01-02',
  noPublicDir: true,
  sourceMap: process.env.ENV_MODE === 'local',

  srcDir: 'server',

  watchOptions: {
    cwd: '.',
    ignored: ['**/node_modules/**', '**/.git/**', '**/.nitro/**', '**/data/**'],
  },
})
