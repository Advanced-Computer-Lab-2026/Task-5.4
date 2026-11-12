const fs = require('node:fs');
const path = require('node:path');

// Prefer an explicitly configured binary, then an existing Windows installation.
// MongoMemoryServer still starts an isolated temporary database for each suite.
if (!process.env.MONGOMS_SYSTEM_BINARY && process.platform === 'win32') {
  const installedBinary = path.join(
    process.env.ProgramFiles || 'C:\\Program Files',
    'MongoDB', 'Server', '8.2', 'bin', 'mongod.exe'
  );
  if (fs.existsSync(installedBinary)) {
    process.env.MONGOMS_SYSTEM_BINARY = installedBinary;
    process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = 'false';
  }
}

module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/server/**/*.test.js'],
      transform: { '^.+\\.js$': 'babel-jest' }
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/client/**/*.test.js'],
      transform: { '^.+\\.js$': 'babel-jest' }
    }
  ]
};
