import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { ETHEREUM_MORPHO_TOKEN_ADDRESS, getRateLimits } from '../consts/mainnet'
import { validateHre } from '../utils/hre'

const contractName = 'MorphoOFTAdapter'

const deploy: DeployFunction = async (hre) => {
    const { eid, deployer, deployments, deploy } = await validateHre(hre)

    assert(eid === EndpointId.ETHEREUM_V2_MAINNET, 'Only supported on Ethereum mainnet')

    console.log(`Deploying ${contractName}, network: ${hre.network.name} with ${deployer}`)

    const endpointV2Deployment = await deployments.get('EndpointV2')

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            ETHEREUM_MORPHO_TOKEN_ADDRESS, // token address
            endpointV2Deployment.address, // LayerZero's EndpointV2 address
            deployer, // owner
            getRateLimits(eid),
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

deploy.tags = [contractName]

export default deploy
