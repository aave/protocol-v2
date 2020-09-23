import {TestEnv, makeSuite} from './helpers/make-suite';
import {RAY, APPROVAL_AMOUNT_LENDING_POOL} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {ProtocolErrors} from '../helpers/types';

const {expect} = require('chai');

makeSuite('AddressesProviderRegistry', (testEnv: TestEnv) => {
 
  it('Checks the addresses provider is added to the registry', async () => {
    
    const {addressesProvider, registry} = testEnv;

    const providers = await registry.getAddressesProvidersList();

    expect(providers.length).to.be.equal(1, "Invalid length of the addresses providers list");
    expect(providers[1].toString()).to.be.equal(addressesProvider.address, " Invalid addresses provider added to the list");

  });


});

