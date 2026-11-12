const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

// Prefer an installed Windows MongoDB over downloading a second copy. Explicit
// MongoMemoryServer settings and the normal download behavior elsewhere remain.
if (process.platform === 'win32' && !process.env.MONGOMS_SYSTEM_BINARY && !process.env.MONGOMS_VERSION) {
  const root = join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
  if (existsSync(root)) {
    const versions = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const binary = versions.map(version => join(root, version, 'bin', 'mongod.exe')).find(existsSync);
    if (binary) {
      const output = execFileSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true });
      const version = output.match(/db version v(\d+\.\d+\.\d+)/);
      if (version) {
        process.env.MONGOMS_SYSTEM_BINARY = binary;
        process.env.MONGOMS_VERSION = version[1];
      }
    }
  }
}
