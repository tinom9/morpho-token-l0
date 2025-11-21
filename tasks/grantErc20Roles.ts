import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { validateHre } from '../utils/hre'
import { executeMultiNetworkTask } from '../utils/multiNetworkTask'

import { LZ_GRANT_ERC20_ROLES_TASK } from './names'

export const grantRoles = async (hre: HardhatRuntimeEnvironment) => {
    const { eid, deployments } = await validateHre(hre)

    if (eid === EndpointId.ARBITRUM_V2_MAINNET) {
        console.log(`Skipping role grant for ${hre.network.name}`)
        return
    }

    const mabaName = 'MorphoMintBurnOFTAdapter'
    const mabaDeployment = await deployments.get(mabaName)
    const { address: mabaAddress } = mabaDeployment

    const tokenName = 'MorphoToken'
    const tokenDeployment = await deployments.get(tokenName)
    const tokenFactory = await hre.ethers.getContractFactory(tokenName)
    const token = tokenFactory.attach(tokenDeployment.address)

    const [minterRole, burnerRole] = await Promise.all([token.MINTER_ROLE(), token.BURNER_ROLE()])

    const grantRoleIfRequired = async (roleName: string, roleHash: string) => {
        const hasRole = await token.hasRole(roleHash, mabaAddress)

        if (hasRole) {
            console.log(`OFT at ${hre.network.name} already has role ${roleName}`)
            return
        }

        console.log(`Granting role ${roleName} for ${hre.network.name}...`)

        const tx = await token.grantRole(roleHash, mabaAddress)
        console.log(`Grant ${roleName} role TX send ${tx.hash}`)
    }

    await grantRoleIfRequired('minter', minterRole)
    await grantRoleIfRequired('burner', burnerRole)
}

task(LZ_GRANT_ERC20_ROLES_TASK, 'Grants required roles to the contracts')
    .addOptionalParam('networks', 'Comma-separated list of networks to grant roles on')
    .setAction(async ({ networks }, hre) => {
        const networkNames = networks
            ? networks.split(',').map((networkName: string) => networkName.trim())
            : [hre.network.name]

        await executeMultiNetworkTask(hre, grantRoles, networkNames)
    })
