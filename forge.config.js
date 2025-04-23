module.exports = {
  packagerConfig: {
    asar: false,
    ignore: [
      /^\/src/,
      /^\/out/,
      /^\/\.git/,
      /^\/\.vscode/,
      /^\/node_modules\/\.cache/,
      /\.map$/,
      /\.ts$/
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
      config: {}
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'Glint',
        format: 'ULFO'
      }
    }
  ]
}; 