const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

// Specific network config is taken by HRE from hardhat.config.js and initialised when this script is run
// If this script is run on Rinkeby; all rinkeby specific config defined in hardhat.config.js is initialised by HRE
// getNamedAccounts & deployments functions are deconstructed from the HRE
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { DEPLOYER } = await getNamedAccounts()
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("----------------------------------------------------")

    const DECIMALS = 8
    const ETH_USD_PRICE = 200000000000

    // arguments is blank bcos we dont have any constructor in our contract
    const arguments = [DECIMALS, ETH_USD_PRICE]
    await deploy("MockV3Aggregator", {
        from: DEPLOYER,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    log("----------------------------------------------------")
}

module.exports.tags = ["test"]
