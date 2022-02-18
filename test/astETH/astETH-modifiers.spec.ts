import { expect } from 'chai';
import { ProtocolErrors } from '../../helpers/types';
import { wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Modifiers', function () {
  const { CT_CALLER_MUST_BE_LENDING_POOL } = ProtocolErrors;

  it('Tries to invoke mint not being the LendingPool', async () => {
    const { astETH, deployer } = setup;
    await expect(astETH.mint(deployer.address, '1', '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke burn not being the LendingPool', async () => {
    const { astETH, deployer } = setup;
    await expect(astETH.burn(deployer.address, deployer.address, '1', '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke transferOnLiquidation not being the LendingPool', async () => {
    const { astETH, lenders, deployer } = setup;
    const { lenderA } = lenders;
    await expect(
      astETH.transferOnLiquidation(deployer.address, lenderA.address, '1')
    ).to.be.revertedWith(CT_CALLER_MUST_BE_LENDING_POOL);
  });

  it('Tries to invoke transferUnderlyingTo not being the LendingPool', async () => {
    const { astETH, deployer } = setup;
    await expect(astETH.transferUnderlyingTo(deployer.address, '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke mintToTreasury not being the LendingPool', async () => {
    const { astETH } = setup;
    await expect(astETH.mintToTreasury(wei`100 ether`, '1')).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });
});
