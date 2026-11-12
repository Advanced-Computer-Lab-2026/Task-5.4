// Lets Jest load the project's ESM source through babel-jest.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
};
