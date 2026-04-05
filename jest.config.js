module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'games/beamlab/engine.module.js',
    'games/parsed/interpreter.module.js',
    'games/beamlab/share.js',
    'games/parsed/share.js',
    'tools/snaplayout/conversions.module.js',
  ],
};
