const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Use an installed Windows binary to start an isolated test database, avoiding
// a download. Explicit configuration wins; other machines keep the default.
if (process.platform === 'win32' && !process.env.MONGOMS_SYSTEM_BINARY) {
  const serverDir = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
  if (fs.existsSync(serverDir)) {
    const binary = fs.readdirSync(serverDir)
      .filter((version) => /^\d+(\.\d+)*$/.test(version))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((version) => path.join(serverDir, version, 'bin', 'mongod.exe'))
      .find((candidate) => fs.existsSync(candidate));

    if (binary) {
      process.env.MONGOMS_SYSTEM_BINARY = binary;
      if (!process.env.MONGOMS_VERSION) {
        const output = execFileSync(binary, ['--version'], {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true
        });
        const version = output.match(/db version v(\d+\.\d+\.\d+)/);
        if (version) process.env.MONGOMS_VERSION = version[1];
      }
    }
  }
}
