const { MongoBinary } = require('mongodb-memory-server');

module.exports = async () => {
  // Download/verify the test binary once before any suite starts. A first-run
  // download can exceed beforeAll's timeout and concurrent downloads can race.
  await MongoBinary.getPath();
};
