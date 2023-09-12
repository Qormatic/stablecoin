const { network } = require("hardhat")
const {
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    DECIMALS,
    INITIAL_ANSWER,
} = require("../helper-hardhat-config")
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

    const arguments = [DECIMALS, INITIAL_ANSWER]

    if (developmentChains.includes(network.name)) {
        log("Local network detected; deploying mocks...!")
        await deploy("MockV3Aggregator", {
            from: DEPLOYER,
            args: arguments,
            log: true,
        })
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["test"]
