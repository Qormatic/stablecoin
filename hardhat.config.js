require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

// RPC ALCHEMY URLS
const ETHEREUM_MAINNET_RPC_URL = process.env.ETHEREUM_MAINNET_RPC_URL
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const POLYGON_MAINNET_RPC_URL = process.env.POLYGON_MAINNET_RPC_URL
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL

// Signers
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const TEST_ACC_ONE_SIGNER = process.env.TEST_ACC_ONE_PRIVATE_KEY
const TEST_ACC_TWO_SIGNER = process.env.TEST_ACC_TWO_PRIVATE_KEY

// named accounts
const DEPLOYER = process.env.DEPLOYER
const TEST_ACC_ONE = process.env.TEST_ACC_ONE
const TEST_ACC_TWO = process.env.TEST_ACC_TWO
const ROYALTIES_RECEIVER = process.env.ROYALTIES_RECEIVER
const PLATFORMFEE_RECIPIENT = process.env.PLATFORMFEE_RECIPIENT

// optional
const MNEMONIC = process.env.MNEMONIC || "your mnemonic"

// Your API key for Etherscan, obtain one at https://etherscan.io/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "Your etherscan API key"
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "Your polygonscan API key"
const REPORT_GAS = process.env.REPORT_GAS || true

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            // // If you want to do some forking, uncomment this
            // forking: {
            //   url: MAINNET_RPC_URL
            // }
            saveDeployments: true,
            chainId: 31337,
            allowUnlimitedContractSize: true,
        },
        localhost: {
            // no need to define accounts as HH Node automatically allocates accounts when run
            chainId: 31337,
            allowUnlimitedContractSize: true,
            // blockGasLimit: 300000000000,
            // gas: 300000000000,
            gasMultiplier: 1.8,
        },
        goerli: {
            url: GOERLI_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            //   accounts: {
            //     mnemonic: MNEMONIC, // mnemonic can be used to access the private keys for all the accounts in your wallet. A single private key works for just one account
            //   },
            saveDeployments: true,
            chainId: 5,
            blockConfirmations: 6,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            //   accounts: {
            //     mnemonic: MNEMONIC, // mnemonic can be used to access the private keys for all the accounts in your wallet. A single private key works for just one account
            //   },
            saveDeployments: true,
            chainId: 11155111,
            blockConfirmations: 6,
        },
        polygonMumbai: {
            url: MUMBAI_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY, TEST_ACC_ONE_SIGNER, TEST_ACC_TWO_SIGNER],
            saveDeployments: true,
            chainId: 80001,
            blockConfirmations: 6,
        },
        polygon: {
            url: POLYGON_MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            saveDeployments: true,
            chainId: 137,
            blockConfirmations: 6,
        },
        mainnet: {
            url: ETHEREUM_MAINNET_RPC_URL,
            accounts: [DEPLOYER_PRIVATE_KEY],
            //   accounts: {
            //     mnemonic: MNEMONIC,
            //   },
            saveDeployments: true,
            chainId: 1,
            blockConfirmations: 6,
        },
    },
    etherscan: {
        // npx hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
            sepolia: ETHERSCAN_API_KEY,
            polygon: POLYGONSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
        },
        customChains: [], // empty customChains array enabled mumbai contract verification
        // customChains: [
        //     // {
        //     //     network: "goerli",
        //     //     chainId: 5,
        //     //     urls: {
        //     //         apiURL: "https://api-goerli.etherscan.io/api",
        //     //         browserURL: "https://goerli.etherscan.io",
        //     //     },
        //     // },
        //     {
        //         network: "polygonMumbai",
        //         chainId: 80001,
        //         urls: {
        //             apiURL: "https://api-testnet.polygonscan.com",
        //             browserURL: "https://mumbai.polygonscan.com",
        //         },
        //     },
        // ],
    },
    gasReporter: {
        enabled: REPORT_GAS,
        // currency: "USD",
        noColors: true,
        showTimeSpent: false,
        outputFile: "gas-report.txt",
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    contractSizer: {
        // plugin to tell you how big your contracts are
        runOnCompile: false,
        only: [
            "Seal_NFTMarketplace",
            "Seal_NFTAuction",
            "Seal_721_Contract",
            "Seal_721_ContractFactory",
        ],
    },
    namedAccounts: {
        DEPLOYER: {
            default: 0, // hre will take, by default, the first account as deployer
            mainnet: DEPLOYER, // Note: depending on how hardhat network are configured, the account 0 on one network can be different than on another
            goerli: DEPLOYER,
            polygonMumbai: DEPLOYER,
        },
        platformFeeRecipient: {
            default: 2,
            goerli: PLATFORMFEE_RECIPIENT,
            polygonMumbai: PLATFORMFEE_RECIPIENT,
        },
        royaltiesReceiver: {
            default: 3,
            goerli: ROYALTIES_RECEIVER,
            polygonMumbai: ROYALTIES_RECEIVER,
        },
        TEST_ACC_ONE: {
            default: 4,
            goerli: TEST_ACC_ONE,
            polygonMumbai: TEST_ACC_ONE,
        },
        TEST_ACC_TWO: {
            default: 5,
            goerli: TEST_ACC_TWO,
            polygonMumbai: TEST_ACC_TWO,
        },
    },
    solidity: {
        // different contracts use different compiler versions
        compilers: [
            {
                version: "0.8.19",
            },
            {
                version: "0.8.7",
            },
            {
                version: "0.4.24",
            },
        ],
    },
    mocha: {
        timeout: 200000, // 200 seconds max for running tests
    },
}
