/**
 * @dev This is a simple script that keeps track of gas spent during deployment.
 */
import { BigNumber } from 'ethers'; 

export var totalGas:BigNumber = BigNumber.from(0);

export function addGas(amount: BigNumber) {
    totalGas = totalGas.add(amount);
}