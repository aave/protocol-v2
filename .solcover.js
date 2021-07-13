const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  client: require('ganache-cli'),
  skipFiles: ['./mocks', './dependencies', './adapters', './misc', './flashloan', './deployments', './interfaces'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
