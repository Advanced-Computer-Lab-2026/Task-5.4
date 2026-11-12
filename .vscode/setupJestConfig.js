// Explicit, one-shot configuration generation; no watchers or process termination.
import fs from 'node:fs';
import path from 'node:path';
const target = path.join(process.cwd(), "jest.config.cjs");
fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) fs.writeFileSync(target, "// One jest run with two environments:\n//   - \"server\" tests run in node (they boot the Express app + in-memory Mongo)\n//   - \"client\" tests run in jsdom (they exercise the browser-side api client)\n// `npm test` runs both.\nmodule.exports = {\n  projects: [\n    {\n      displayName: 'server',\n      testEnvironment: 'node',\n      testMatch: ['<rootDir>/tests/server/**/*.test.js'],\n      transform: {\n        '^.+\\\\.js$': 'babel-jest'\n      }\n    },\n    {\n      displayName: 'client',\n      testEnvironment: 'jsdom',\n      testMatch: ['<rootDir>/tests/client/**/*.test.js'],\n      transform: {\n        '^.+\\\\.js$': 'babel-jest'\n      }\n    }\n  ]\n};\n");
