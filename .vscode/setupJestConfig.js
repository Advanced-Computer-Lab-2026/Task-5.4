import fs from 'fs';
import path from 'path';

// Manual-only config generator. No watchers or child processes.
const jestConfigPath = path.join(process.cwd(), 'jest.config.cjs');
const jestConfigContent = "// One jest run with two environments:\r\n//   - \"server\" tests run in node (they boot the Express app + in-memory Mongo)\r\n//   - \"client\" tests run in jsdom (they exercise the browser-side api client)\r\n// `npm test` runs both.\r\nmodule.exports = {\r\n  projects: [\r\n    {\r\n      displayName: 'server',\r\n      testEnvironment: 'node',\r\n      testMatch: ['<rootDir>/tests/server/**/*.test.js'],\r\n      transform: {\r\n        '^.+\\\\.js$': 'babel-jest'\r\n      }\r\n    },\r\n    {\r\n      displayName: 'client',\r\n      testEnvironment: 'jsdom',\r\n      testMatch: ['<rootDir>/tests/client/**/*.test.js'],\r\n      transform: {\r\n        '^.+\\\\.js$': 'babel-jest'\r\n      }\r\n    }\r\n  ]\r\n};\r\n";

if (!fs.existsSync(jestConfigPath)) {
  fs.writeFileSync(jestConfigPath, jestConfigContent, { encoding: 'utf8' });
}
