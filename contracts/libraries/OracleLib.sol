// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/*
 * @title OracleLib
 * @author Patrick Collins
 * @notice This library is used to check the Chainlink Oracle for stale data.
 * If a price is stale, functions will revert, and render the DSCEngine unusable - this is by design.
 * We want the DSCEngine to freeze if prices become stale.
 *
 * So if the Chainlink network explodes and you have a lot of money locked in the protocol... too bad.
 */
library OracleLib {
    error OracleLib__StalePrice();

    // different chains have different timeouts & different tokens can have different timeouts on the same chain
    //  MATIC (18), wETH (18), DAI (18), wBTC (8), USDC (6)

    // pricefeeds are supposed to be updated every 27 seconds on olygon but in reality they can take longer
    uint256 private constant TIMEOUT = 90; // 90 seconds

    function staleCheckLatestRoundData(
        AggregatorV3Interface chainlinkFeed
    ) internal view returns (uint80, int256, uint256, uint256, uint80) {
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = chainlinkFeed.latestRoundData();

        if (updatedAt == 0 || answeredInRound < roundId) {
            revert OracleLib__StalePrice();
        }
        uint256 secondsSince = block.timestamp - updatedAt;
        if (secondsSince > TIMEOUT) revert OracleLib__StalePrice();

        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function getTimeout(
        AggregatorV3Interface /* chainlinkFeed */
    ) internal pure returns (uint256) {
        return TIMEOUT;
    }
}
