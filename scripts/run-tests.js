const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function findInstalledMongo() {
  if (process.env.MONGOMS_SYSTEM_BINARY && existsSync(process.env.MONGOMS_SYSTEM_BINARY)) {
    return process.env.MONGOMS_SYSTEM_BINARY;
  }

  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const lookup = spawnSync(command, ['mongod'], { encoding: 'utf8' });
  const fromPath = lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean) : undefined;
  if (fromPath && existsSync(fromPath)) return fromPath;

  if (process.platform === 'win32' && process.env.ProgramFiles) {
    const serverRoot = join(process.env.ProgramFiles, 'MongoDB', 'Server');
    if (existsSync(serverRoot)) {
      const versions = spawnSync('powershell.exe', [
        '-NoProfile', '-Command',
        `Get-ChildItem -Directory -LiteralPath '${serverRoot.replaceAll("'", "''")}' | Sort-Object { [version]$_.Name } -Descending | ForEach-Object { Join-Path $_.FullName 'bin\\mongod.exe' }`
      ], { encoding: 'utf8' });
      const installedBinary = versions.stdout.split(/\r?\n/).find((file) => file && existsSync(file));
      if (installedBinary) return installedBinary;
    }
  }
}

const installedMongo = findInstalledMongo();
if (installedMongo) {
  process.env.MONGOMS_SYSTEM_BINARY = installedMongo;
  process.env.MONGOMS_VERSION_CHECK = 'false';
}

const jestBin = join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');
const result = spawnSync(process.execPath, [jestBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
