import {configuration as actionsConfiguration} from "./helpers/actions";
import {configuration as calculationsConfiguration} from "./helpers/utils/calculations";

import fs from "fs";
import BigNumber from "bignumber.js";
import {makeSuite} from "./helpers/make-suite";
import {MOCK_ETH_ADDRESS, getReservesConfigByPool} from "../helpers/constants";
import {AavePools, iAavePoolAssets, IReserveParams} from "../helpers/types";
import {executeStory} from "./helpers/scenario-engine";

BigNumber.config({DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN});

const scenarioFolder = "./test/helpers/scenarios/";

fs.readdirSync(scenarioFolder).forEach((file) => {
  if (file !== "deposit.json") return;

  const scenario = require(`./helpers/scenarios/${file}`);

  makeSuite(scenario.title, async (testEnv) => {
    before("Initializing configuration", async () => {
      actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

      calculationsConfiguration.reservesParams = <
        iAavePoolAssets<IReserveParams>
      >getReservesConfigByPool(AavePools.proto);
      calculationsConfiguration.ethereumAddress = MOCK_ETH_ADDRESS;
    });

    for (const story of scenario.stories) {
      it(story.description, async () => {
        await executeStory(story, testEnv);
      });
    }
  });
});
