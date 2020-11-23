pragma solidity ^0.6;

/**
 * @title ITokenConfiguration
 * @author Aave
 * @dev common interface between aTokens and debt tokens to fetch the
 * token configuration
 **/
interface ITokenConfiguration {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function POOL() external view returns (address);
}
