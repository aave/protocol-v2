// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {Errors} from '../libraries/helpers/Errors.sol';
import {VersionedInitializable} from '../../protocol/libraries/sturdy-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
import {ISwapRouter} from '../../interfaces/ISwapRouter.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {UniswapAdapter} from '../libraries/swap/UniswapAdapter.sol';
import {CurveswapAdapter} from '../libraries/swap/CurveswapAdapter.sol';

/**
 * @title YieldManager
 * @notice yield distributor by swapping from assets to stable coin
 * @author Sturdy
 **/

contract YieldManager is VersionedInitializable, Ownable {
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  struct AssetYield {
    address asset;
    uint256 amount;
  }

  // the list of the available reserves, structured as a mapping for gas savings reasons
  mapping(uint256 => address) internal _assetsList;
  mapping(address => bool) internal _assetManaged;
  uint256 internal _assetsCount;

  ILendingPoolAddressesProvider internal _addressesProvider;

  uint256 private constant REVISION = 0x1;

  address public _exchangeToken;

  // tokenIn -> tokenOut -> Curve Pool Address
  mapping(address => mapping(address => address)) internal _curvePools;

  uint256 private constant UNISWAP_FEE = 10000; // 1%

  /**
   * @dev Emitted on setExchangeToken()
   * @param _token The address of token being used as an exchange token
   */
  event NewExchangeToken(address _token);

  /**
   * @dev Emitted on registerAsset()
   * @param _asset The address of reward asset
   */
  event RegisterAsset(address _asset);

  /**
   * @dev Emitted on unregisterAsset()
   * @param _asset The address of asset being removed from reward token list
   */
  event UnregisterAsset(address _asset);

  /**
   * @dev Emitted on setCurvePool()
   * @param _tokenIn The address of token being swapped
   * @param _tokenOut The address of token being received
   * @param _pool The address of Curve Pool being used for swapping
   */
  event AddCurveSwapPool(address _tokenIn, address _tokenOut, address _pool);

  modifier onlyAdmin() {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  modifier onlyYieldProcessor() {
    require(
      _addressesProvider.getAddress('YIELD_PROCESSOR') == msg.sender,
      Errors.CALLER_NOT_YIELD_PROCESSOR
    );
    _;
  }

  /**
   * @dev Function is invoked by the proxy contract when the Vault contract is deployed.
   * @param _provider The address of the provider
   **/
  function initialize(ILendingPoolAddressesProvider _provider) external initializer {
    _addressesProvider = _provider;
  }

  function setExchangeToken(address _token) external payable onlyAdmin {
    require(_token != address(0), Errors.VT_INVALID_CONFIGURATION);
    _exchangeToken = _token;

    emit NewExchangeToken(_token);
  }

  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }

  function registerAsset(address _asset) external payable onlyAdmin {
    require(_asset != address(0), Errors.VT_INVALID_CONFIGURATION);
    require(_assetManaged[_asset] != true, Errors.VT_INVALID_CONFIGURATION);

    _assetsList[_assetsCount] = _asset;
    _assetManaged[_asset] = true;
    _assetsCount += 1;

    emit RegisterAsset(_asset);
  }

  function unregisterAsset(uint256 _index) external payable onlyAdmin {
    uint256 count = _assetsCount;
    require(_index < count, Errors.VT_INVALID_CONFIGURATION);

    address _asset = _assetsList[_index];
    _assetManaged[_asset] = false;

    emit UnregisterAsset(_asset);

    count -= 1;
    if (_index == count) return;

    _assetsList[_index] = _assetsList[count];
    _assetsCount = count;
  }

  function getAssetCount() external view returns (uint256) {
    return _assetsCount;
  }

  function getAssetInfo(uint256 _index) external view returns (address) {
    return _assetsList[_index];
  }

  /**
   * @dev Function to set Curve Pool address for the swap
   * @param _tokenIn The address of token being exchanged
   * @param _tokenOut The address of token being received
   * @param _pool The address of the Curve pool to use for the swap
   */
  function setCurvePool(
    address _tokenIn,
    address _tokenOut,
    address _pool
  ) external payable onlyAdmin {
    require(_tokenIn != address(0), Errors.VT_INVALID_CONFIGURATION);
    require(_tokenOut != address(0), Errors.VT_INVALID_CONFIGURATION);
    require(_pool != address(0), Errors.VT_INVALID_CONFIGURATION);

    _curvePools[_tokenIn][_tokenOut] = _pool;

    emit AddCurveSwapPool(_tokenIn, _tokenOut, _pool);
  }

  /**
   * @dev Function to get Curve Pool address for the swap
   * @param _tokenIn The address of token being sent
   * @param _tokenOut The address of token being received
   */
  function getCurvePool(address _tokenIn, address _tokenOut) external view returns (address) {
    return _curvePools[_tokenIn][_tokenOut];
  }

  /**
   * @dev Distribute the yield of assets to suppliers.
   *      1. convert asset to exchange token(for now it's USDC) via Uniswap
   *      2. convert exchange token to other stables via Curve
   *      3. deposit to pool for suppliers
   * @param _offset assets array's start offset.
   * @param _count assets array's count when perform distribution.
   * @param _slippage The slippage of the swap 1% = 100
   * @param _paths The swapping path of uniswap
   **/
  function distributeYield(
    uint256 _offset,
    uint256 _count,
    uint256 _slippage,
    UniswapAdapter.Path[] calldata _paths
  ) external payable onlyYieldProcessor {
    require(_paths.length == _count, Errors.VT_SWAP_PATH_LENGTH_INVALID);

    address token = _exchangeToken;
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // 1. convert from asset to exchange token via uniswap
    for (uint256 i; i < _count; ++i) {
      address asset = _assetsList[_offset + i];
      require(asset != address(0), Errors.UL_INVALID_INDEX);
      uint256 amount = IERC20Detailed(asset).balanceOf(address(this));
      UniswapAdapter.swapExactTokensForTokens(provider, asset, token, amount, _paths[i], _slippage);
    }
    uint256 exchangedAmount = IERC20Detailed(token).balanceOf(address(this));

    // 2. convert from exchange token to other stable assets via curve swap
    AssetYield[] memory assetYields = _getAssetYields(exchangedAmount, provider);

    _depositAssetYields(assetYields, provider, token, _slippage);
  }

  /**
   * @dev deposit Yields to pool for suppliers
   **/
  function _depositAssetYields(
    AssetYield[] memory _assetYields,
    ILendingPoolAddressesProvider _provider,
    address _token,
    uint256 _slippage
  ) internal {
    uint256 length = _assetYields.length;
    for (uint256 i; i < length; ++i) {
      if (_assetYields[i].amount > 0) {
        uint256 amount;

        if (_assetYields[i].asset == _token) {
          amount = _assetYields[i].amount;
        } else {
          address pool = _curvePools[_token][_assetYields[i].asset];
          require(pool != address(0), Errors.VT_INVALID_CONFIGURATION);
          amount = CurveswapAdapter.swapExactTokensForTokens(
            _provider,
            pool,
            _token,
            _assetYields[i].asset,
            _assetYields[i].amount,
            _slippage
          );
        }
        // 3. deposit Yield to pool for suppliers
        address lendingPool = _provider.getLendingPool();
        IERC20(_assetYields[i].asset).safeApprove(lendingPool, 0);
        IERC20(_assetYields[i].asset).safeApprove(lendingPool, amount);
        ILendingPool(lendingPool).depositYield(_assetYields[i].asset, amount);
      }
    }
  }

  /**
   * @dev Get the list of asset and asset's yield amount
   **/
  function _getAssetYields(uint256 _totalYieldAmount, ILendingPoolAddressesProvider provider)
    internal
    view
    returns (AssetYield[] memory)
  {
    // Get total borrowing asset volume and volumes and assets
    (
      uint256 totalVolume,
      uint256[] memory volumes,
      address[] memory assets,
      uint256 length
    ) = ILendingPool(provider.getLendingPool()).getBorrowingAssetAndVolumes();

    if (totalVolume == 0) return new AssetYield[](0);

    AssetYield[] memory assetYields = new AssetYield[](length);
    uint256 extraYieldAmount = _totalYieldAmount;

    for (uint256 i; i < length; ++i) {
      assetYields[i].asset = assets[i];
      if (i == length - 1) {
        // without calculation, set remained extra amount
        assetYields[i].amount = extraYieldAmount;
      } else {
        // Distribute yieldAmount based on percent of asset volume
        assetYields[i].amount = _totalYieldAmount.percentMul(
          (volumes[i] * PercentageMath.PERCENTAGE_FACTOR) / totalVolume
        );
        extraYieldAmount -= assetYields[i].amount;
      }
    }

    return assetYields;
  }
}
