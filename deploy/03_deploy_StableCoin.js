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

    // arguments is blank bcos we dont have any constructor in our contract
    const arguments = []
    const stableCoinContract = await deploy("DecentralizedStableCoin", {
        from: DEPLOYER,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // If not deploying on localhost -> verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(stableCoinContract.address, arguments)
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["test", "real"]
