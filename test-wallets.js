const toWad = require("./helpers/misc-utils").toWad;

module.exports = {
  accounts: [
    {
      secretKey:
        "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122",
      balance: toWad(1_000_000),
    },
    {
      secretKey:
        "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb",
      balance: toWad(1_000_000),
    },
    {
      secretKey:
        "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569",
      balance: toWad(1_000_000),
    },
  ],
};
