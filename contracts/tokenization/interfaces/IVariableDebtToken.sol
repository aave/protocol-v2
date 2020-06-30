pragma solidity ^0.6.0;


interface IVariableDebtToken {

  function mint(address account, uint256 amount) external virtual;

  function burn(address _account, uint256 _amount) external virtual;

  function getUserIndex(address _account) external virtual view returns(uint256);
}
