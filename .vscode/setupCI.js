import fs from 'fs';
import path from 'path';

// Manual-only CI generator. Never writes assistant instruction files.
const workflowDir = path.join(process.cwd(), '.github', 'workflows');
const filePath = path.join(workflowDir, 'ci.yaml');
const ciContent = "name: CI\r\n\r\non:\r\n  push:\r\n  pull_request:\r\n\r\njobs:\r\n  test:\r\n    runs-on: ubuntu-latest\r\n\r\n    steps:\r\n      - name: Check out the code\r\n        uses: actions/checkout@v4\r\n\r\n      - name: Set up Node.js\r\n        uses: actions/setup-node@v4\r\n        with:\r\n          node-version: '20'\r\n\r\n      - name: Install dependencies\r\n        run: npm install\r\n\r\n      - name: Run the test suite\r\n        run: npm test\r\n";

fs.mkdirSync(workflowDir, { recursive: true });
fs.writeFileSync(filePath, ciContent, { encoding: 'utf8' });
