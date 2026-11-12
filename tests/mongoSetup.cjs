const path = require('node:path');
const { MongoBinary } = require('mongodb-memory-server');

// Download before test hooks run: a first download can exceed their 60s limit.
module.exports = async () => {
  process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve(__dirname, '../.cache/mongodb-binaries');
  await MongoBinary.getPath();
};
