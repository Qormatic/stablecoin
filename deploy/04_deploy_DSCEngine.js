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

    const wethContract = await ethers.getContract("WETH9")
    const mockV3Contract = await ethers.getContract("MockV3Aggregator")
    // const ethUsdPriceFeedContract = "0x694AA1769357215DE4FAC081bf1f309aDC325306" ---> real sepolia price feed
    const dscContract = await ethers.getContract("DecentralizedStableCoin")

    console.log("wethContract.address", wethContract.address)
    console.log("mockV3Contract.address", mockV3Contract.address)
    console.log("dscContract.address", dscContract.address)

    // arguments is blank bcos we dont have any constructor in our contract
    const arguments = [
        [wethContract.address], // An array of token addresses
        [mockV3Contract.address], // An array of price feed addresses
        dscContract.address, // The address of the dsc contract
    ]
    const dsceContract = await deploy("DSCEngine", {
        from: DEPLOYER,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // If not deploying on localhost -> verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(dsceContract.address, arguments)
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["test", "real"]
