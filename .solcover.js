const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  client: require('ganache-cli'),
  skipFiles: [],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
