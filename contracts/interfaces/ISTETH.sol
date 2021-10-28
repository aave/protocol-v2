// SPDX-FileCopyrightText: 2020 Lido <info@lido.fi>

// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

/**
 * @title A liquid version of ETH 2.0 native token
 *
 * ERC20 token which supports stop/resume mechanics. The token is operated by `ILido`.
 *
 * Since balances of all token holders change when the amount of total controlled Ether
 * changes, this token cannot fully implement ERC20 standard: it only emits `Transfer`
 * events upon explicit transfer between holders. In contrast, when Lido oracle reports
 * rewards, no Transfer events are generated: doing so would require emitting an event
 * for each token holder and thus running an unbounded loop.
 */
/* is IERC20 */
interface ISTETH {
  function totalSupply() external view returns (uint256);

  /**
   * @notice Stop transfers
   */
  function stop() external;

  /**
   * @notice Resume transfers
   */
  function resume() external;

  /**
   * @notice Returns true if the token is stopped
   */
  function isStopped() external view returns (bool);

  event Stopped();
  event Resumed();

  /**
   * @notice Increases shares of a given address by the specified amount. Called by Lido
   *         contract in two cases: 1) when a user submits an ETH1.0 deposit; 2) when
   *         ETH2.0 rewards are reported by the oracle. Upon user deposit, Lido contract
   *         mints the amount of shares that corresponds to the submitted Ether, so
   *         token balances of other token holders don't change. Upon rewards report,
   *         Lido contract mints new shares to distribute fee, effectively diluting the
   *         amount of Ether that would otherwise correspond to each share.
   *
   * @param _to Receiver of new shares
   * @param _sharesAmount Amount of shares to mint
   * @return The total amount of all holders' shares after new shares are minted
   */
  function mintShares(address _to, uint256 _sharesAmount) external returns (uint256);

  /**
   * @notice Burn is called by Lido contract when a user withdraws their Ether.
   * @param _account Account which tokens are to be burnt
   * @param _sharesAmount Amount of shares to burn
   * @return The total amount of all holders' shares after the shares are burned
   */
  function burnShares(address _account, uint256 _sharesAmount) external returns (uint256);

  function balanceOf(address owner) external view returns (uint256);

  function transfer(address to, uint256 value) external returns (bool);

  function getTotalShares() external view returns (uint256);

  function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);

  function getSharesByPooledEth(uint256 _pooledEthAmount) external view returns (uint256);
}
