const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe
    : describe("DSCEngine Unit Tests", function () {
          let accounts,
              deployer,
              user,
              user2,
              liquidator,
              dsceContract,
              coinContract,
              oracleLib,
              user_DSCE,
              user2_DSCE,
              user_coinContract,
              user_Mock,
              deployer_DSCE,
              liquidator_DSCE,
              lowDepositAmount,
              depositAmount,
              largeDepositAmount,
              amountDscToMint,
              largeAmountDSCToMint,
              MockV3Aggregator,
              roundId,
              priceDrop,
              timeStamp,
              startedAt,
              MAX_UINT256,
              liquidator_coinContract,
              liquidator_wethContract,
              justTooMuchAmountDscToMint

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              user2 = accounts[2]
              liquidator = accounts[3]

              // deployments.fixture runs all our deploy scripts with the tag "test"
              // By default it deploys with whichever account is account[0] - deployer in our case
              await deployments.fixture(["test"])

              // getContract will return the most recently deployed version of the contract e.g. the one that deployments.fixture deployed
              wethContract = await ethers.getContract("WETH9")
              dsceContract = await ethers.getContract("DSCEngine")
              coinContract = await ethers.getContract("DecentralizedStableCoin")
              MockV3Aggregator = await ethers.getContract("MockV3Aggregator")

              user_DSCE = dsceContract.connect(user)
              user_Mock = MockV3Aggregator.connect(user)
              user_coinContract = coinContract.connect(user)
              user_wethContract = wethContract.connect(user)
              user2_DSCE = dsceContract.connect(user2)
              user2_wethContract = wethContract.connect(user2)
              deployer_DSCE = dsceContract.connect(deployer)
              liquidator_DSCE = dsceContract.connect(liquidator)
              liquidator_coinContract = coinContract.connect(liquidator)
              liquidator_wethContract = wethContract.connect(liquidator)

              // user gets WETH tokens which he can use as collateral
              await user_wethContract.deposit({ value: ethers.utils.parseEther("50") })
              await liquidator_wethContract.deposit({ value: ethers.utils.parseEther("50") })

              lowDepositAmount = ethers.utils.parseEther("2") // 2e18
              depositAmount = ethers.utils.parseEther("3") // 3e18
              largeDepositAmount = ethers.utils.parseEther("6") // 5e18
              amountDscToMint = ethers.utils.parseEther("1000") // 1e18
              justTooMuchAmountDscToMint = ethers.utils.parseEther("1501") // 1e18
              largeAmountDSCToMint = ethers.utils.parseEther("2000") // 2e18
              MAX_UINT256 = ethers.constants.MaxUint256
          })

          ///////////////////////////
          //  depositCollateral()  //
          ///////////////////////////

          describe("depositCollateral", function () {
              beforeEach(async () => {
                  // approve the DSCEngine to spend WETH on behalf of the user
                  await user_wethContract.approve(dsceContract.address, MAX_UINT256)
                  await liquidator_wethContract.approve(dsceContract.address, MAX_UINT256)
              })

              it("collateral deposited and user balance updated correctly", async function () {
                  const preDepositUserBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  await user_DSCE.depositCollateral(wethContract.address, depositAmount)

                  const postDepositUserBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  const postDollarValueOfCollateral = await user_DSCE.getAccountCollateralValue(
                      user.address
                  )

                  console.log("postDepositUserBalance", postDepositUserBalance.toString())
                  console.log(
                      "postDollarValueOfCollateral: ",
                      "$" + postDollarValueOfCollateral.toString()
                  )

                  // Check that the user's collateral balance has increased by the deposit amount
                  assert(
                      preDepositUserBalance.add(depositAmount).toString() ==
                          postDepositUserBalance.toString()
                  )
              })
          })

          /////////////////
          //  mintDSC()  //
          /////////////////

          describe("mintDSC", function () {
              beforeEach(async () => {
                  // approve the DSCEngine to spend WETH on behalf of the user
                  await user_wethContract.approve(dsceContract.address, MAX_UINT256)

                  await user_DSCE.depositCollateral(wethContract.address, depositAmount)
              })

              it("mints DSC and user balance updated correctly", async function () {
                  const preDscBalance = await coinContract.balanceOf(user.address)
                  console.log("preDscBalance", preDscBalance.toString())

                  console.log("amountDscToMint", amountDscToMint.toString())

                  await user_DSCE.mintDsc(amountDscToMint)

                  const postDscBalance = await coinContract.balanceOf(user.address)
                  console.log("postDscBalance", postDscBalance.toString())

                  // user DSC balance should have increased by amountDscToMint
                  assert(
                      preDscBalance.add(amountDscToMint).toString() == postDscBalance.toString()
                  )
              })

              it.only("fails if user DSC balance after mintDSC() will be less than 20", async function () {
                  const preDscBalance = await coinContract.balanceOf(user.address)
                  console.log("preDscBalance", preDscBalance.toString())

                  const mappingBal = await user_DSCE.s_DSCMinted(user.address)
                  console.log("mappingBal", mappingBal.toString())

                  amountDscToMint = ethers.utils.parseEther("10")
                  console.log("amountDscToMint", amountDscToMint.toString())

                  // user DSC balance should have increased by amountDscToMint
                  await expect(user_DSCE.mintDsc(amountDscToMint)).to.be.revertedWith(
                      "DSCEngine__BelowMinDscLevel"
                  )
              })
          })

          /////////////////////////////////////
          //  depositCollateralAndMintDsc()  //
          /////////////////////////////////////

          describe("depositCollateralAndMintDsc", function () {
              beforeEach(async () => {
                  // approve the DSCEngine to spend WETH on behalf of the user
                  await user_wethContract.approve(dsceContract.address, MAX_UINT256)
              })

              it("deposits collateral, mints DSC and user balances updated correctly", async function () {
                  const preDepositUserBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )
                  const preDscBalance = await coinContract.balanceOf(user.address)

                  console.log("preDepositUserBalance", preDepositUserBalance.toString())
                  console.log("preDscBalance", preDscBalance.toString())
                  console.log("amountDscToMint", amountDscToMint.toString())

                  await user_DSCE.depositCollateralAndMintDsc(
                      wethContract.address,
                      depositAmount,
                      ethers.utils.parseEther("1501")
                  )

                  const postDepositUserBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )
                  const postDscBalance = await coinContract.balanceOf(user.address)

                  console.log("postDepositUserBalance", postDepositUserBalance.toString())
                  console.log("postDscBalance", postDscBalance.toString())

                  // user DSC balance should have increased by amountDscToMint
                  assert(
                      preDscBalance.add(ethers.utils.parseEther("1501")).toString() ==
                          postDscBalance.toString()
                  )
              })

              it("deposits collateral, mints DSC and user balances updated correctly", async function () {
                  const preDepositUserBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )
                  const preDscBalance = await coinContract.balanceOf(user.address)

                  console.log("preDepositUserBalance", preDepositUserBalance.toString())
                  console.log("preDscBalance", preDscBalance.toString())
                  console.log("amountDscToMint", amountDscToMint.toString())

                  await expect(
                      user_DSCE.depositCollateralAndMintDsc(
                          wethContract.address,
                          depositAmount,
                          justTooMuchAmountDscToMint
                      )
                  ).to.be.revertedWith("DSCEngine__BreaksHealthFactor")
              })
          })

          ///////////////////
          //  liquidate()  //
          ///////////////////

          describe("liquidate", function () {
              beforeEach(async () => {
                  // approve the DSCEngine to spend WETH on behalf of the user
                  await user_wethContract.approve(dsceContract.address, MAX_UINT256)
                  await liquidator_wethContract.approve(dsceContract.address, MAX_UINT256)
                  await liquidator_coinContract.approve(dsceContract.address, MAX_UINT256)

                  const allowance = await user_wethContract.allowance(
                      user.address,
                      dsceContract.address
                  )

                  console.log("allowance: ", allowance.toString())

                  const collateralTokens = await dsceContract.getCollateralTokens()
                  console.log("collateralTokens", collateralTokens)

                  await liquidator_DSCE.depositCollateralAndMintDsc(
                      wethContract.address,
                      ethers.utils.parseEther("6"), // deposit 6 WETH
                      ethers.utils.parseEther("2000") // mint 2000 DSC
                  )

                  roundId = "2"
                  priceDrop = "500000000000000000000" // 50% drop; mock initial price = 1e18
                  let currentTime = (await ethers.provider.getBlock("latest")).timestamp
                  timeStamp = currentTime - 10
                  startedAt = currentTime - 10
              })

              it("liquidates user correctly", async function () {
                  ////// MIN_HEALTH_FACTOR = 1e18 //////

                  const preDscBalance = await coinContract.balanceOf(user.address)

                  // user starts at 200% collateralisation with 100% HF
                  await user_DSCE.depositCollateralAndMintDsc(
                      wethContract.address,
                      ethers.utils.parseEther("1"), // deposit 1 WETH ($1000)
                      ethers.utils.parseEther("500") // mint 500 DSC
                  )

                  const preHF = await user_DSCE.getHealthFactor(user.address)

                  const preWethBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  const preDollarValueOfCollateral = await user_DSCE.getAccountCollateralValue(
                      user.address
                  )

                  console.log("preDscBalance", preDscBalance.toString())
                  console.log("preHF: ", preHF.toString())
                  console.log("preWethBalance: ", preWethBalance.toString())
                  console.log(
                      "preDollarValueOfCollateral: ",
                      "$" + preDollarValueOfCollateral.toString()
                  )

                  // get current value of wETH wrt $USD
                  const price = await user_Mock.latestRoundData()
                  console.log("price", price.toString())

                  // price drop by 50%
                  await user_Mock.updateRoundData(roundId, priceDrop, timeStamp, startedAt)

                  const newPrice = await user_Mock.latestRoundData()
                  console.log("newPrice", newPrice.toString())

                  const postDscBalance = await coinContract.balanceOf(user.address) // 500 DSC

                  const postHF = await user_DSCE.getHealthFactor(user.address)

                  const postWethBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  const postDollarValueOfCollateral = await user_DSCE.getAccountCollateralValue(
                      // $500 000 000 000 000 000 000
                      user.address
                  )

                  console.log("postDscBalance", postDscBalance.toString())
                  console.log("postHF: ", postHF.toString()) // 50%
                  console.log("postWethBalance: ", postWethBalance.toString())
                  console.log(
                      "postDollarValueOfCollateral: ",
                      "$" + postDollarValueOfCollateral.toString()
                  )

                  await liquidator_DSCE.liquidate(wethContract.address, user.address, MAX_UINT256)

                  const user_DSC_Balance = await user_coinContract.balanceOf(user.address)
                  const liq_DSC_Balance = await liquidator_coinContract.balanceOf(
                      liquidator.address
                  )

                  console.log("user_DSC_Balance: ", user_DSC_Balance.toString())
                  console.log("liq_DSC_Balance: ", liq_DSC_Balance.toString())
              })

              it("liquidate user correctly when user collateralisation between 100 - 110%", async function () {
                  await user_DSCE.depositCollateralAndMintDsc(
                      wethContract.address,
                      ethers.utils.parseEther("3.24"), // deposit 3.24 wETH
                      ethers.utils.parseEther("1500") // mint 1500 DSC
                  )

                  const preHF = await user_DSCE.getHealthFactor(user.address)

                  const preWethBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  const preDollarValueOfCollateral = await user_DSCE.getAccountCollateralValue(
                      user.address
                  )

                  console.log("preHF: ", preHF.toString())
                  console.log("preWethBalance: ", preWethBalance.toString())
                  console.log(
                      "preDollarValueOfCollateral: ",
                      "$" + preDollarValueOfCollateral.toString()
                  )

                  // get current value of wETH wrt $USD
                  const price = await user_Mock.latestRoundData()
                  console.log("price", price.toString())

                  // price drop by 50% will make user collateralisation 108% & HF 54%
                  await user_Mock.updateRoundData(roundId, priceDrop, timeStamp, startedAt)

                  const newPrice = await user_Mock.latestRoundData()
                  console.log("newPrice", newPrice.toString())

                  const postHF = await user_DSCE.getHealthFactor(user.address)

                  const postWethBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  const postDollarValueOfCollateral = await user_DSCE.getAccountCollateralValue(
                      user.address
                  )

                  console.log("postHF: ", postHF.toString())
                  console.log("postWethBalance: ", postWethBalance.toString())
                  console.log(
                      "postDollarValueOfCollateral: ",
                      "$" + postDollarValueOfCollateral.toString()
                  )

                  await liquidator_DSCE.liquidate(wethContract.address, user.address, MAX_UINT256)

                  const user_DSC_Balance = await user_coinContract.balanceOf(user.address)
                  const liq_DSC_Balance = await liquidator_coinContract.balanceOf(
                      liquidator.address
                  )

                  console.log("user_DSC_Balance: ", user_DSC_Balance.toString())
                  console.log("liq_DSC_Balance: ", liq_DSC_Balance.toString())
              })
          })
      })
