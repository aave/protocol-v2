// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';
import './WadRayMath.sol';

library MathUtils {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 internal constant SECONDS_PER_YEAR = 365 days;

  /**
   * @dev function to calculate the interest using a linear interest rate formula
   * @param _rate the interest rate, in ray
   * @param _lastUpdateTimestamp the timestamp of the last update of the interest
   * @return the interest rate linearly accumulated during the timeDelta, in ray
   **/

  function calculateLinearInterest(uint256 _rate, uint40 _lastUpdateTimestamp)
    internal
    view
    returns (uint256)
  {
    //solium-disable-next-line
    uint256 timeDifference = block.timestamp.sub(uint256(_lastUpdateTimestamp));

    uint256 timeDelta = timeDifference.wadToRay().rayDiv(SECONDS_PER_YEAR.wadToRay());

    return _rate.rayMul(timeDelta).add(WadRayMath.ray());
  }

  /**
   * @dev function to calculate the interest using a compounded interest rate formula
   * @param _rate the interest rate, in ray
   * @param _lastUpdateTimestamp the timestamp of the last update of the interest
   * @return the interest rate compounded during the timeDelta, in ray
   **/
  function calculateCompoundedInterest(uint256 _rate, uint40 _lastUpdateTimestamp)
    internal
    view
    returns (uint256)
  {
    //solium-disable-next-line
    uint256 timeDifference = block.timestamp.sub(uint256(_lastUpdateTimestamp));

    uint256 ratePerSecond = _rate.div(SECONDS_PER_YEAR);

    return ratePerSecond.add(WadRayMath.ray()).rayPow(timeDifference);
  }
}
