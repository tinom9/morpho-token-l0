import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import { task } from 'hardhat/config'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { validateHre } from '../utils/hre'
import { promptForConfirmationOrExit } from '../utils/prompts'

import { LZ_RENOUNCE_ERC20_ROLES_TASK } from './names'

task(LZ_RENOUNCE_ERC20_ROLES_TASK, 'Renounce ERC20 minter, burner, and upgrader roles').setAction(async (args, hre) => {
    const { eid, deployments, deployer } = await validateHre(hre)

    const isArbitrum = eid === EndpointId.ARBITRUM_V2_MAINNET
    const tokenName = isArbitrum ? 'MorphoTokenArbitrum' : 'MorphoToken'

    if (isArbitrum) {
        console.log(`Skipping role renounce for ${hre.network.name}`)
        return
    }

    const tokenDeployment = await deployments.get(tokenName)
    const tokenFactory = await hre.ethers.getContractFactory(tokenName)
    const token = tokenFactory.attach(tokenDeployment.address)

    const renounceRoleIfRequired = async (roleName: string) => {
        let roleHash: string
        try {
            roleHash = await token[roleName]()
        } catch (error) {
            console.log(`${roleName} role could not be fetched, using \`keccak256("${roleName}")\``)
            roleHash = keccak256(toUtf8Bytes(roleName))
        }

        const isRoleDefault = roleHash === '0x' + '0'.repeat(64)
        if (isRoleDefault) {
            console.log(`${roleName} role is not intended to be renounced in this task`)
            return
        }

        const hasRole = await token.hasRole(roleHash, deployer)
        if (!hasRole) {
            console.log(`Signer at ${deployer} does not have ${roleName} role, nothing to renounce`)
            return
        }

        console.log(`Signer at ${deployer} has ${roleName} role, renouncing role`)
        await promptForConfirmationOrExit()

        const tx = await token.renounceRole(roleHash, deployer)
        console.log(`${roleName} role renounce TX sent ${tx.hash}`)
        await tx.wait()
        console.log(`${roleName} role renounce TX confirmed`)
    }

    await renounceRoleIfRequired('MINTER_ROLE')
    await renounceRoleIfRequired('BURNER_ROLE')
    await renounceRoleIfRequired('UPGRADER_ROLE')
})
