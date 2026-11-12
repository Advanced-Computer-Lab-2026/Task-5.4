// Explicit, one-shot configuration generation; no watchers or process termination.
import fs from 'node:fs';
import path from 'node:path';
const target = path.join(process.cwd(), ".github/workflows/ci.yaml");
fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) fs.writeFileSync(target, "name: CI\n\non:\n  push:\n  pull_request:\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Check out the code\n        uses: actions/checkout@v4\n\n      - name: Set up Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n\n      - name: Install dependencies\n        run: npm install\n\n      - name: Run the test suite\n        run: npm test\n");
