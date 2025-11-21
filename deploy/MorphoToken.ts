import { type DeployFunction } from 'hardhat-deploy/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { LZ_RENOUNCE_ERC20_ROLES_TASK } from '../tasks/names'
import { validateHre } from '../utils/hre'

const genericContractName = 'MorphoToken'
const arbitrumContractName = 'MorphoTokenArbitrum'

const deploy: DeployFunction = async (hre) => {
    const { eid, deployer, deploy } = await validateHre(hre)

    const isArbitrum = eid === EndpointId.ARBITRUM_V2_MAINNET

    const contractName = isArbitrum ? arbitrumContractName : genericContractName
    console.log(`Deploying ${contractName}, network: ${hre.network.name} with ${deployer}`)

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [], // No constructor args for UUPS implementation
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        proxy: {
            proxyContract: 'UUPS',
            owner: deployer,
            execute: {
                init: {
                    methodName: 'initialize',
                    args: ['Morpho Token', 'MORPHO', deployer], // name, symbol, owner
                },
            },
        },
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)

    console.log(`Renouncing ERC20 roles for ${contractName} on ${hre.network.name}...`)
    await hre.run(LZ_RENOUNCE_ERC20_ROLES_TASK)
}

deploy.tags = [genericContractName, arbitrumContractName]

export default deploy
