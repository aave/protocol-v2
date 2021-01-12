// Should be a ts file that has a global var var gas = 0;
import { BigNumber } from 'ethers'; 

export var totalGas:BigNumber = BigNumber.from(0);

export function addGas(amount: BigNumber) {
    totalGas = totalGas.add(amount);
}