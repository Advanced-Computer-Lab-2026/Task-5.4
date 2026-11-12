// One jest run with two environments:
//   - "server" tests run in node (they boot the Express app + in-memory Mongo)
//   - "client" tests run in jsdom (they exercise the browser-side api client)
// `npm test` runs both.
module.exports = {
  maxWorkers: 1,
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/setupMongo.cjs',
      testMatch: ['<rootDir>/tests/server/**/*.test.js'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/client/**/*.test.js'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    }
  ]
};
