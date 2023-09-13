// SPDX-License-Identifier: MIT

// Layout of Contract:
// version
// imports
// interfaces, libraries, contracts
// errors
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// view & pure functions

pragma solidity ^0.8.18;

import {DecentralizedStableCoin} from "./DecentralizedStableCoin.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {OracleLib} from "./libraries/OracleLib.sol";

/**
 * The system is designed to be as minimal as possible, and have the tokens maintain a 1 token == $1 peg
 * The system is designed to be overcollateralized, and liquidators are incentivized to liquidate users who are below the liquidation threshold
 * The system ensures a 2-to-1 collateral backing, meaning for every $1 of DSC minted, there is $2 in collateral value."
 *
 * This stablecoin has the properties:
 * - Exogenous Collateral
 * - Dollar Pegged
 * - Algoritmically Stable
 *
 * @notice This contract handles all the logic for mining and redeeming DSC, as well as depositing & withdrawing collateral.
 */
contract DSCEngine is ReentrancyGuard {
    ////////////
    // Errors //
    ////////////

    error DSCEngine__NeedsMoreThanZero();
    error DSCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength();
    error DSCEngine__NotAllowedToken();
    error DSCEngine__TransferFailed();
    error DSCEngine__BreaksHealthFactor(uint256 healthFactor);
    error DSCEngine__MintFailed();
    error DSCEngine__HealthFactorOk();
    error DSCEngine__HealthFactorNotImproved();
    error DSCEngine__TokenAlreadyAdded();
    error DSCEngine__DscBelowThreshold();
    error DSCEngine__BelowMinDscLevel(uint256 dscMinted);
    error DSCEngine__InvalidZeroAddress();

    //////////
    // Type //
    //////////

    using OracleLib for AggregatorV3Interface;

    /////////////////////
    // State Variables //
    /////////////////////

    uint256 private constant ADDITIONAL_FEED_PRECISION = 1e10;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 50; // 200% overcollateralized
    uint256 private constant LIQUIDATION_PRECISION = 100;
    uint256 private constant MIN_HEALTH_FACTOR = 1e18; // 100% health factor or 1:1 collateralization
    uint256 private constant LIQUIDATION_BONUS = 10; // 10% of covered debt
    uint256 private constant MIN_DSC_BALANCE = 10e18; // 10 DSC

    mapping(address token => address priceFeed) private s_priceFeeds; // tokenToPriceFeed
    mapping(address user => mapping(address token => uint256 amount))
        private s_collateralDeposited;
    mapping(address user => uint256 amountDscMinted) public s_DSCMinted;
    address[] private s_collateralTokens;

    DecentralizedStableCoin private immutable i_dsc;

    ////////////
    // Events //
    ////////////

    event CollateralDeposited(address indexed user, address indexed token, uint256 indexed amount);
    event CollateralRedeemed(
        address indexed redeemedFrom,
        address indexed redeemedTo,
        address indexed token,
        uint256 amount
    );
    event DscMinted(address indexed user, uint256 indexed amount);
    event DscBurnt(address indexed liquidator, uint256 indexed amount, address indexed user);
    event UserLiquidated(
        address indexed liquidator,
        address indexed user,
        address collateral,
        uint256 indexed debtToCover,
        uint256 totalCollateralToRedeem
    );

    ///////////////
    // Modifiers //
    ///////////////

    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert DSCEngine__NeedsMoreThanZero();
        }
        _;
    }

    modifier isAllowedToken(address token) {
        if (s_priceFeeds[token] == address(0)) {
            revert DSCEngine__NotAllowedToken();
        }
        _;
    }

    ///////////////
    // Functions //
    ///////////////

    constructor(
        address[] memory tokenAddresses,
        address[] memory priceFeedAddresses,
        address dscAddress
    ) {
        // USD Price Feeds
        if (tokenAddresses.length != priceFeedAddresses.length) {
            revert DSCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength();
        }
        // Whitelist to accept wMATIC (18), wETH (18), DAI (18), wBTC (8), USDC (6); leaving array length unbounded in case that changes
        // None of these tokens implement fee-on-transfer
        // USDC uses a proxy / implementation contract which could be changed
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            if (s_priceFeeds[tokenAddresses[i]] != address(0)) {
                revert DSCEngine__TokenAlreadyAdded();
            }
            if (tokenAddresses[i] == address(0) || priceFeedAddresses[i] == address(0)) {
                revert DSCEngine__InvalidZeroAddress();
            }

            s_priceFeeds[tokenAddresses[i]] = priceFeedAddresses[i];
            s_collateralTokens.push(tokenAddresses[i]);
        }
        i_dsc = DecentralizedStableCoin(dscAddress);
    }

    ////////////////////////
    // External Functions //
    ////////////////////////

    /*
     * @param tokenCollateralAddress The address of the token to deposit as collateral
     * @param amountCollateral The amount of collateral to deposit
     * @param amountDscToMint The amount of decentralized stablecoin to mint
     * @notice this function will deposit your collateral and mint DSC in one transaction
     * @notice if collateral value were $3000 user could mint a maximum of $1500 worth of DSC or 1500 DSC tokens
     */
    function depositCollateralAndMintDsc(
        address tokenCollateralAddress,
        uint256 amountCollateral,
        uint256 amountDscToMint
    ) external {
        depositCollateral(tokenCollateralAddress, amountCollateral);
        mintDsc(amountDscToMint);
    }

    /*
     * @notice follows CEI
     * @param tokenCollateralAddress The address of the token to deposit as collateral
     * @param amountCollateral The amount of collateral to deposit
     * @notice user needs to approve DSCEngine in the ERC20 collateral contract for amountCollateral before calling depositCollateral - handled on the frontend
     */
    function depositCollateral(
        address tokenCollateralAddress,
        uint256 amountCollateral
    ) public moreThanZero(amountCollateral) isAllowedToken(tokenCollateralAddress) nonReentrant {
        s_collateralDeposited[msg.sender][tokenCollateralAddress] += amountCollateral;
        emit CollateralDeposited(msg.sender, tokenCollateralAddress, amountCollateral);
        bool success = IERC20(tokenCollateralAddress).transferFrom(
            msg.sender,
            address(this),
            amountCollateral
        );
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
    }

    /*
     * @notice follows CEI
     * @param amountDscToMint The amount of decentralized stablecoin to mint
     * @notice they must have more collateral value than the minimum threshold
     * @notice user can mint DSC to the value of 50% of their collateral value (e.g. $3000 collateral -> 1500 DSC)
     * @notice mininum DSC level is 10 DSC; low DSC debt can make liquidate() uneconomical for liquidators due to gas costs
     */
    function mintDsc(uint256 amountDscToMint) public moreThanZero(amountDscToMint) nonReentrant {
        uint256 currentMinted = s_DSCMinted[msg.sender];

        // Check if the amount after minting will be less than the minimum allowed balance
        if (currentMinted + amountDscToMint < MIN_DSC_BALANCE) {
            revert DSCEngine__BelowMinDscLevel(s_DSCMinted[msg.sender]);
        }

        s_DSCMinted[msg.sender] = currentMinted + amountDscToMint;
        _revertIfHealthFactorIsBroken(msg.sender);
        bool minted = i_dsc.mint(msg.sender, amountDscToMint);
        if (!minted) {
            revert DSCEngine__MintFailed();
        }
        emit DscMinted(msg.sender, amountDscToMint);
    }

    /*
     * @param tokenCollateralAddress The collateral address to redeem
     * @param amountCollateral The amount of collateral to redeem
     * @param amountDscToBurn The amount of DSC to burn
     * This function burns DSC and redeems underlying collateral in one transaction
     */
    function redeemCollateralForDsc(
        address tokenCollateralAddress,
        uint256 amountCollateral,
        uint256 amountDscToBurn
    ) external {
        burnDsc(amountDscToBurn);
        redeemCollateral(tokenCollateralAddress, amountCollateral);
    }

    /*
     * @param tokenCollateralAddress: The ERC20 token address of the collateral you're redeeming
     * @param amountCollateral: The amount of collateral you're redeeming
     * @notice This function will redeem your collateral.
     * @notice If you have DSC minted, you will not be able to redeem until you burn your DSC
     */
    function redeemCollateral(
        address tokenCollateralAddress,
        uint256 amountCollateral
    ) public moreThanZero(amountCollateral) nonReentrant {
        _redeemCollateral(msg.sender, msg.sender, tokenCollateralAddress, amountCollateral);
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    /*
     * @notice user can burn their DSC if they are approaching the liquidation threshold and improve their health factor
     * @notice user needs to approve DSCEngine in the DSC contract for amount before calling burnDsc - handled on the frontend
     */
    function burnDsc(uint256 amount) public moreThanZero(amount) {
        _burnDsc(amount, msg.sender, msg.sender);
    }

    /*
     * @param collateral The erc20 collateral address to liquidate from the user
     * @param user The user who has broken the health factor. Their _healthFactor should be below MIN_HEALTH_FACTOR
     * @param debtToCover The amount of the liquidator's own DSC (in wei) they transfer to DSCEngine to improve the users health factor
     * @notice You can partially liquidate a user.
     * @notice You will get a liquidation bonus for taking the users funds
     * @notice This function assumes the protocol is 200% overcollateralized in order for it to work
     * @notice If the protocol is 100% or less collateralized liquidators will not be incentived
     */
    function liquidate(
        address collateral,
        address user,
        uint256 debtToCover
    ) external moreThanZero(debtToCover) nonReentrant {
        uint256 startingUserHealthFactor = _healthFactor(user);
        if (startingUserHealthFactor >= MIN_HEALTH_FACTOR) {
            revert DSCEngine__HealthFactorOk();
        }

        // allow liquidation of all the DSC debt
        if (debtToCover == type(uint256).max) {
            (uint256 dscMinted, ) = _getAccountInformation(user);
            debtToCover = dscMinted;
        }

        //  Return the amount of collateral (token) we need to redeem based on the amount of DSC (amountDSC) we want to burn
        uint256 tokenAmountFromDebtCovered = getTokenAmountFromUsd(collateral, debtToCover);
        uint256 bonusCollateral = (tokenAmountFromDebtCovered * LIQUIDATION_BONUS) /
            LIQUIDATION_PRECISION;

        // total amount we want to redeem (110% of debtCovered); bonusCollateral paid by person being liquidated out of their collateral
        uint256 totalCollateralToRedeem = tokenAmountFromDebtCovered + bonusCollateral; // 110%

        // return the total amount of collateral (token) user has deposited
        uint256 totalDepositedCollateral = s_collateralDeposited[user][collateral];

        // If the amount to be redeemed exceeds what user has deposited, we redeem all their collateral instead e.g. their HF is between 100% < 110%
        if (
            tokenAmountFromDebtCovered <= totalDepositedCollateral &&
            totalCollateralToRedeem > totalDepositedCollateral
        ) {
            totalCollateralToRedeem = totalDepositedCollateral;
        }

        _redeemCollateral(user, msg.sender, collateral, totalCollateralToRedeem);

        _burnDsc(debtToCover, user, msg.sender);

        uint256 endingUserHealthFactor = _healthFactor(user);
        if (endingUserHealthFactor <= startingUserHealthFactor) {
            revert DSCEngine__HealthFactorNotImproved();
        }

        emit UserLiquidated(msg.sender, user, collateral, debtToCover, totalCollateralToRedeem);
    }

    //////////////////////////////////
    // Private & Internal Functions //
    //////////////////////////////////

    /*
     * @dev Low-level internal function, do not call unless the function calling it is checking for health factors being broken
     */
    function _burnDsc(uint256 amountDscToBurn, address onBehalfOf, address dscFrom) private {
        // 1. liquidated user's DSC removed from protocol mapping; cannot be used in the protocol anymore. It is not burned tho so user can use it elsewhere
        s_DSCMinted[onBehalfOf] -= amountDscToBurn;

        // 2. liquidator transfers DSC of amountDscToBurn to this contract
        i_dsc.transferFrom(dscFrom, address(this), amountDscToBurn);

        // 3. liquidator's transferred DSC is burned
        i_dsc.burn(amountDscToBurn);

        emit DscBurnt(onBehalfOf, amountDscToBurn, dscFrom);
    }

    function _redeemCollateral(
        address from,
        address to,
        address tokenCollateralAddress,
        uint256 amountCollateral
    ) private {
        s_collateralDeposited[from][tokenCollateralAddress] -= amountCollateral;
        emit CollateralRedeemed(from, to, tokenCollateralAddress, amountCollateral);
        bool success = IERC20(tokenCollateralAddress).transfer(to, amountCollateral);
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
    }

    ////////////////////////////////////////////
    // Private & Internal View/Pure Functions //
    ////////////////////////////////////////////

    function _getAccountInformation(
        address user
    ) private view returns (uint256 totalDscMinted, uint256 collateralValueInUsd) {
        totalDscMinted = s_DSCMinted[user];
        collateralValueInUsd = getAccountCollateralValue(user);
    }

    /*
     * @notice Returns how close to liquidation a user is; if below 1e18 they can get liquidated
     */
    function _healthFactor(address user) private view returns (uint256) {
        (uint256 totalDscMinted, uint256 collateralValueInUsd) = _getAccountInformation(user);
        return _calculateHealthFactor(totalDscMinted, collateralValueInUsd);
    }

    /*
     * @notice Transaction reverts if the user's health factor is below the minimum threshold
     */
    function _revertIfHealthFactorIsBroken(address user) internal view {
        uint256 userHealthFactor = _healthFactor(user);
        if (userHealthFactor < MIN_HEALTH_FACTOR) {
            revert DSCEngine__BreaksHealthFactor(userHealthFactor);
        }
    }

    /*
     * @param LIQUIDATION_THRESHOLD is 50 (indicating 200% collateralisation)
     * @param LIQUIDATION_PRECISION is 100
     */
    function _calculateHealthFactor(
        uint256 totalDscMinted,
        uint256 collateralValueInUsd
    ) internal pure returns (uint256) {
        // return 2^256 - 1 if totalDscMinted == 0 i.e. healthFactor is 100%
        if (totalDscMinted == 0) return type(uint256).max;

        // if user has $3000 collateral and 1500 DSC they are 200% collateralized and their HF is 100% or 1e18
        return
            (collateralValueInUsd * LIQUIDATION_THRESHOLD * 1e18) /
            (LIQUIDATION_PRECISION * totalDscMinted);
    }

    //////////////////////////////////////////////
    // External & Public View & Pure Functions  //
    //////////////////////////////////////////////

    /*
     * @notice Return the amount of collateral (token) we need to redeem based on the amount of DSC (amountDSC) we want to burn
     */
    function getTokenAmountFromUsd(
        address token,
        uint256 amountDSC
    ) public view returns (uint256) {
        if (token == address(0)) {
            revert DSCEngine__InvalidZeroAddress();
        }
        AggregatorV3Interface priceFeed = AggregatorV3Interface(s_priceFeeds[token]);
        (, int256 price, , , ) = priceFeed.staleCheckLatestRoundData();

        // adjust price to ensure we match the token's decimals; since we are returning a token amount
        uint8 decimals = priceFeed.decimals();
        uint256 priceWithDecimals = (uint256(price) * 1e18) / (10 ** decimals);

        return (amountDSC * PRECISION) / priceWithDecimals;
    }

    /*
     * @param user is the address of the user whose value of collateral you want
     * @notice this a given user, this function will loop through all the collateral tokens and get the value of each in USD
     * @notice returns total USD value of all user's collateral
     */
    function getAccountCollateralValue(
        address user
    ) public view returns (uint256 totalCollateralValueInUsd) {
        for (uint256 i = 0; i < s_collateralTokens.length; i++) {
            address token = s_collateralTokens[i];
            uint256 amount = s_collateralDeposited[user][token];
            totalCollateralValueInUsd += getUsdValue(token, amount);
        }
        return totalCollateralValueInUsd;
    }

    /*
     * @param token comes from s_collateralTokens
     * @param amount comes from s_collateralDeposited mapping; could be 8/10/18 decimals
     * @notice returns USD value for single token collateral
     */
    function getUsdValue(address token, uint256 amount) public view returns (uint256) {
        if (token == address(0)) {
            revert DSCEngine__InvalidZeroAddress();
        }

        AggregatorV3Interface priceFeed = AggregatorV3Interface(s_priceFeeds[token]);
        (, int256 price, , , ) = priceFeed.staleCheckLatestRoundData(); // price will be 1e8

        // adjust price for token decimals to ensure we return an 18-decimal USD amount
        uint8 decimals = priceFeed.decimals();
        uint256 priceWithDecimals = (uint256(price) * 1e18) / (10 ** decimals);

        return (priceWithDecimals * amount) / PRECISION;
    }

    function getAccountInformation(
        address user
    ) external view returns (uint256 totalDscMinted, uint256 collateralValueInUsd) {
        (totalDscMinted, collateralValueInUsd) = _getAccountInformation(user);
    }

    function getAdditionalFeedPrecision() external pure returns (uint256) {
        return ADDITIONAL_FEED_PRECISION;
    }

    function getPrecision() external pure returns (uint256) {
        return PRECISION;
    }

    function calculateHealthFactor(
        uint256 totalDscMinted,
        uint256 collateralValueInUsd
    ) external pure returns (uint256) {
        return _calculateHealthFactor(totalDscMinted, collateralValueInUsd);
    }

    function getHealthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }

    function getLiquidationBonus() external pure returns (uint256) {
        return LIQUIDATION_BONUS;
    }

    function getCollateralTokenPriceFeed(address token) external view returns (address) {
        return s_priceFeeds[token];
    }

    function getCollateralTokens() external view returns (address[] memory) {
        return s_collateralTokens;
    }

    function getMinHealthFactor() external pure returns (uint256) {
        return MIN_HEALTH_FACTOR;
    }

    function getLiquidationThreshold() external pure returns (uint256) {
        return LIQUIDATION_THRESHOLD;
    }

    function getCollateralBalanceOfUser(
        address user,
        address token
    ) external view returns (uint256) {
        return s_collateralDeposited[user][token];
    }

    function getDsc() external view returns (address) {
        return address(i_dsc);
    }
}
