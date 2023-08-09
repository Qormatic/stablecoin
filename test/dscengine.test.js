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
              deployer_DSCE,
              liquidator_DSCE

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              user2 = accounts[2] // for setting up new 721Contract via factory
              liquidator = accounts[3]

              console.log("deployer", deployer.address)
              console.log("user", user.address)
              console.log("user2", user2.address)
              console.log("liquidator", liquidator.address)

              // accounts[0]    // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
              // accounts[1]    // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
              // accounts[2]    // 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
              // accounts[3]    // 0x90F79bf6EB2c4f870365E785982E1f101E93b906
              // accounts[4]    // 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
              // accounts[5]    // 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc

              // deployments.fixture runs all our deploy scripts with the tag "test"
              // By default it deploys with whichever account is account[0] - deployer in our case
              await deployments.fixture(["test"])

              // getContract will return the most recently deployed version of the contract e.g. the one that deployments.fixture deployed
              wethContract = await ethers.getContract("WETH9")
              dsceContract = await ethers.getContract("DSCEngine")
              coinContract = await ethers.getContract("DecentralizedStableCoin")

              user_DSCE = dsceContract.connect(user)
              user2_DSCE = dsceContract.connect(user2)
              user_wethContract = wethContract.connect(user)
              user_coinContract = coinContract.connect(user)
              deployer_DSCE = dsceContract.connect(deployer)
              liquidator_DSCE = dsceContract.connect(liquidator)

              // user gets WETH tokens which he can use as collateral
              await user_wethContract.deposit({ value: ethers.utils.parseEther("3") })
              await user_wethContract.withdraw(ethers.utils.parseEther("3"))
              const collateralTokens = await user_DSCE.getCollateralTokens()
              const pricefeed = await user_DSCE.getCollateralTokenPriceFeed(collateralTokens[0])

              //   const userBalance = await user_wethContract.balanceOf(user.address)

              //   console.log("userBalance", userBalance.toString())
              console.log("collateralTokens", collateralTokens)
              console.log("pricefeed", pricefeed)
          })

          /////////////////////
          //  createOffer()  //
          /////////////////////

          describe("depositCollateral", function () {
              beforeEach(async () => {})

              it.only("tokens are sent and received correctly", async function () {
                  await user_wethContract.approve(
                      dsceContract.address,
                      ethers.utils.parseEther("3")
                  )

                  console.log("here1")

                  await user_DSCE.depositCollateral(
                      wethContract.address,
                      ethers.utils.parseEther("3")
                  )

                  console.log("here2")

                  const collateralBalance = await user_DSCE.getCollateralBalanceOfUser(
                      user.address,
                      wethContract.address
                  )

                  console.log("collateralBalance", collateralBalance)

                  //   assert(
                  //       preFundContractBalance.add(_price).toString() ==
                  //           postFundContractBalance.toString()
                  //   )
              })

              it("reverts if item is already on offer", async function () {
                  expect(
                      await nftMarketplaceOther.createOffer(_nftAddress, _tokenId, {
                          value: _price,
                      })
                  ).to.emit("OfferCreated")

                  await expect(
                      nftMarketplaceOther.createOffer(_nftAddress, _tokenId, {
                          value: _price,
                      })
                  ).to.be.revertedWith("Seal_NFTMarketplace__OfferAlreadyExists")
              })

              it("reverts if item has already been listed", async function () {
                  await nftMarketplaceDeployer.listItem(_nftAddress, _tokenId, _price)

                  await expect(
                      nftMarketplaceOther.createOffer(_nftAddress, _tokenId, {
                          value: _price,
                      })
                  ).to.be.revertedWith("Seal_NFTMarketplace__AlreadyListed")
              })

              it("reverts if item is already on auction", async function () {
                  const nftAuctionContract = await ethers.getContract("Seal_NFTAuction")
                  const nftAuctionDeployer = nftAuctionContract.connect(deployer)
                  await basicNftDeployer.setApprovalForAll(nftAuctionContract.address, true)

                  const _minBidReserve = true
                  const _reservePrice = ethers.utils.parseEther("0.1") // 1e17

                  expect(
                      await nftAuctionDeployer.createAuction(
                          _nftAddress,
                          _tokenId,
                          _reservePrice,
                          _minBidReserve
                      )
                  ).to.emit("AuctionCreated")

                  await expect(
                      nftMarketplaceOther.createOffer(_nftAddress, _tokenId, {
                          value: _price,
                      })
                  ).to.be.revertedWith("Seal_NFTMarketplace__AuctionExists")
              })

              it("reverts if item is not 721", async function () {
                  await expect(
                      nftMarketplaceOther.createOffer(_1155Address, _tokenId, {
                          value: _price,
                      })
                  ).to.be.revertedWith("Seal_NFTMarketplace__ContractNotCompatible")
              })

              it("reverts if value is less than s_minPrice", async function () {
                  await expect(
                      nftMarketplaceOther.createOffer(_nftAddress, _tokenId, {
                          value: _lowPrice,
                      })
                  ).to.be.revertedWith("Seal_NFTMarketplace__PriceTooLow")
              })
          })
      })
