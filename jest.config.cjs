module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/server'],
      testMatch: ['**/*.test.js'],
      transform: { '^.+\\.js$': 'babel-jest' }
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/tests/client'],
      testMatch: ['**/*.test.js'],
      transform: { '^.+\\.js$': 'babel-jest' }
    }
  ]
};
