pragma solidity ^0.6.0;


interface IStableDebtToken {

  function mint(
    address account,
    uint256 amount,
    uint256 rate
  ) external virtual;

  function burn(address _account, uint256 _amount) external virtual;

  function getAverageStableRate() external virtual view returns(uint256);

  function getUserStableRate(address _user) external virtual view returns(uint256);

  function getUserLastUpdated(address _user) external virtual view returns (uint40);
}
