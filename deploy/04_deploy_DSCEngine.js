const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

// Specific network config is taken by HRE from hardhat.config.js and initialised when this script is run
// If this script is run on Rinkeby; all rinkeby specific config defined in hardhat.config.js is initialised by HRE
// getNamedAccounts & deployments functions are deconstructed from the HRE
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments
    const { DEPLOYER } = await getNamedAccounts()
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    let ethUsdPriceFeedAddress
    if (developmentChains.includes(network.name)) {
        const ethUsdAggregator = await get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address
    } else {
        ethUsdPriceFeedAddress = networkConfig[network.name]["ethUsdPriceFeed"]
    }

    log("----------------------------------------------------")

    const wethContract = await ethers.getContract("WETH9")
    const dscContract = await ethers.getContract("DecentralizedStableCoin")

    // arguments is blank bcos we dont have any constructor in our contract
    const arguments = [
        [wethContract.address], // An array of token addresses
        [ethUsdPriceFeedAddress], // An array of price feed addresses
        dscContract.address, // The address of the dsc contract
    ]

    const stableCoinContract = await ethers.getContract("DecentralizedStableCoin")

    const dsceContract = await deploy("DSCEngine", {
        from: DEPLOYER,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // Transfer ownership of stable coin contract to DSCEngine
    const dscTX = await stableCoinContract.transferOwnership(dsceContract.address)
    await dscTX.wait(1)

    // If not deploying on localhost -> verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(dsceContract.address, arguments)
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["test", "real"]
