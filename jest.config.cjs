module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  clearMocks: true
};
