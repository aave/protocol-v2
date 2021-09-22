import axios from 'axios';
import { task } from 'hardhat/config';
import { getDb, printContracts } from '../../helpers/misc-utils';
import fs from 'fs-extra';
import path from 'path';
import { Readable } from 'stream';
import FormData from 'form-data';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';

const SOURCIFY_URL = 'https://sourcify.dev/server/';

function log(...args: any[]) {
  console.log(...args);
}

function logError(...args: any[]) {
  console.error(...args);
}

function logInfo(...args: any[]) {
  console.warn(...args);
}

function logSuccess(...args: any[]) {
  console.log(...args);
}

async function submit(name: string, address: string, metadata: string, chainId: string) {
  if (!metadata) {
    throw '[submit] missing medatada';
  }
  try {
    const checkResponse = await axios.get(
      `${SOURCIFY_URL}checkByAddresses?addresses=${address.toLowerCase()}&chainIds=${chainId}`
    );
    const { data: checkData } = checkResponse;
    if (checkData[0].status === 'perfect') {
      log(`already verified: ${name} (${address}), skipping.`);
      return;
    }
  } catch (e) {
    logError(((e as any).response && JSON.stringify((e as any).response.data)) || e);
  }

  logInfo(`verifying ${name} (${address} on chain ${chainId}) ...`);

  const formData = new FormData();
  formData.append('address', address);
  formData.append('chain', chainId);

  const fileStream = new Readable();
  fileStream.push(metadata);
  fileStream.push(null);
  formData.append('files', fileStream, 'metadata.json');

  try {
    const submissionResponse = await axios.post(SOURCIFY_URL, formData, {
      headers: formData.getHeaders(),
    });
    if (submissionResponse.data.result[0].status === 'perfect') {
      logSuccess(` => contract ${name} is now verified`);
    } else {
      console.log(JSON.stringify(submissionResponse.data, null, 2));
      logError(` => contract ${name} is not verified`);
    }
  } catch (e: any) {
    logError(((e as any).response && JSON.stringify((e as any).response.data)) || e);
  }
}

/**
 * Highly inspired by Sourcify plugin for Hardhat Deploy.
 * source: https://github.com/wighawag/hardhat-deploy/blob/master/src/sourcify.ts
 **/
task('publish-sourcify', 'Publish contracts metadata from hardhat-deploy to Sourcify').setAction(
  async ({}, hre) => {
    const contractNames = [
      'LendingPoolImpl',
      /*
      'LendingPoolConfiguratorImpl',
      'LendingPoolCollateralManagerImpl',
      'DefaultReserveInterestRateStrategy',
      'GenericLogic',
      'ReserveLogic',
      'AToken',
      'WETHGateway',
      'VariableDebtToken',
      'StableDebtToken',
      'LendingPoolAddressesProvider',
      'LendingPoolAddressesProviderRegistry',
      'AaveOracle',
      'UiPoolDataProvider',
      */
    ];

    for (let x = 0; x < contractNames.length; x++) {
      const address: string = (await getDb().get(`${contractNames[x]}.${hre.network.name}`).value())
        .address;

      if (!address) {
        throw `Missing address for contract ${contractNames[x]}`;
      }

      const artifact = await hre.deployments.getExtendedArtifact(
        contractNames[x].replace(/Impl$/, '')
      );

      console.log(JSON.stringify(JSON.parse(artifact.metadata || '')));
      await submit(contractNames[x], address, artifact.metadata || '', await hre.getChainId());
    }
  }
);
