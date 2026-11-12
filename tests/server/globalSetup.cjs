const { MongoBinary } = require('mongodb-memory-server');

// Prepare the binary once, before Jest starts timed hooks or parallel workers.
// A first-time download can take several minutes on Windows. Let the downloader
// finish (or report its own network error) instead of abandoning it after 60s.
// https://typegoose.github.io/mongodb-memory-server/docs/guides/integration-examples/test-runners/
module.exports = async () => {
  await MongoBinary.getPath();
};
