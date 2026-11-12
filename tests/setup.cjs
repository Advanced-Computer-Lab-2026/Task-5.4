const path = require('node:path');

process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server');
