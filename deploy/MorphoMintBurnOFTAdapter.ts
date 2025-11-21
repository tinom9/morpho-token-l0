import { type DeployFunction } from 'hardhat-deploy/types'

import { useBigBlock, useSmallBlock } from '@layerzerolabs/hyperliquid-composer'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { getRateLimits } from '../consts/mainnet'
import { LZ_GRANT_ERC20_ROLES_TASK } from '../tasks/names'
import { validateHre } from '../utils/hre'
import { loadHreWallet } from '../utils/wallet'

const contractName = 'MorphoMintBurnOFTAdapter'

const deploy: DeployFunction = async (hre) => {
    const { eid, deployer, deployments, deploy } = await validateHre(hre)

    console.log(`Deploying ${contractName}, network: ${hre.network.name} with ${deployer}`)

    const isHyperEvm = eid === EndpointId.HYPERLIQUID_V2_MAINNET
    const isArbitrum = eid === EndpointId.ARBITRUM_V2_MAINNET
    const isTestnet = false

    const wallet = isHyperEvm ? loadHreWallet(hre) : undefined
    const logLevel = hre.hardhatArguments.verbose ? 'debug' : 'error'

    const endpointV2Deployment = await deployments.get('EndpointV2')
    const tokenDeployment = await deployments.get(isArbitrum ? 'MorphoTokenArbitrum' : 'MorphoToken')

    const existingDeployment = await deployments.getOrNull(contractName)
    if (isHyperEvm && !existingDeployment) await useBigBlock(wallet!, isTestnet, logLevel, true)

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            tokenDeployment.address, // token address
            tokenDeployment.address, // token address implementing IMintableBurnable
            endpointV2Deployment.address, // LayerZero's EndpointV2 address
            deployer, // owner
            getRateLimits(eid),
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    })

    if (isHyperEvm && !existingDeployment) await useSmallBlock(wallet!, isTestnet, logLevel, true)

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)

    console.log(`Granting ERC20 roles for ${contractName} on ${hre.network.name}...`)
    await hre.run(LZ_GRANT_ERC20_ROLES_TASK)
}

deploy.tags = [contractName]

export default deploy
