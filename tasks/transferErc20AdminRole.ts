import { task } from 'hardhat/config'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { getOwnerAddress } from '../consts/mainnet'
import { validateHre } from '../utils/hre'
import { promptForConfirmationOrExit } from '../utils/prompts'

import { LZ_TRANSFER_ERC20_ADMIN_ROLE_TASK } from './names'

task(LZ_TRANSFER_ERC20_ADMIN_ROLE_TASK, 'Transfer ERC20 default admin role to owner').setAction(async (args, hre) => {
    const { eid, deployments, deployer } = await validateHre(hre)

    const isArbitrum = eid === EndpointId.ARBITRUM_V2_MAINNET
    const tokenName = isArbitrum ? 'MorphoTokenArbitrum' : 'MorphoToken'

    if (isArbitrum) {
        console.log(`Skipping role transfer for ${hre.network.name}`)
        return
    }

    const tokenDeployment = await deployments.get(tokenName)
    const tokenFactory = await hre.ethers.getContractFactory(tokenName)
    const token = tokenFactory.attach(tokenDeployment.address)

    const defaultAdminRole = await token.DEFAULT_ADMIN_ROLE()

    const intendedOwner = getOwnerAddress(eid)
    if (intendedOwner.toLowerCase() === deployer.toLowerCase()) {
        throw new Error('Intended owner is signer, cannot transfer roles')
    }

    const grantDefaultAdminRoleIfRequired = async () => {
        const isDefaultAdmin = await token.hasRole(defaultAdminRole, intendedOwner)
        if (isDefaultAdmin) {
            console.log(`Intended owner at ${intendedOwner} is already default admin`)
            return
        }

        console.log(`Intended owner at ${intendedOwner} is not default admin, granting role from ${deployer}`)

        const isSignerDefaultAdmin = await token.hasRole(defaultAdminRole, deployer)
        if (!isSignerDefaultAdmin) {
            throw new Error(`Signer ${deployer} is not default admin`)
        }

        await promptForConfirmationOrExit()

        const tx = await token.grantRole(defaultAdminRole, intendedOwner)
        console.log(`Intended owner default admin grant TX sent ${tx.hash}`)
        await tx.wait()
        console.log(`Intended owner default admin grant TX confirmed`)
    }

    await grantDefaultAdminRoleIfRequired()

    const renounceSignerDefaultAdminRoleIfRequired = async () => {
        const isSignerDefaultAdmin = await token.hasRole(defaultAdminRole, deployer)
        if (!isSignerDefaultAdmin) {
            console.log(`Signer at ${deployer} is not default admin, nothing to renounce`)
            return
        }

        const isDefaultAdmin = await token.hasRole(defaultAdminRole, intendedOwner)
        if (!isDefaultAdmin) {
            throw new Error(`Intended owner at ${intendedOwner} is not default admin, cannot renounce role`)
        }

        console.log(
            `Both signer at ${deployer} and intended owner at ${intendedOwner} are default admins, renouncing signer role`
        )

        await promptForConfirmationOrExit()

        const tx = await token.renounceRole(defaultAdminRole, deployer)
        console.log(`Signer default admin renounce TX sent ${tx.hash}`)
        await tx.wait()
        console.log(`Signer default admin renounce TX confirmed`)
    }

    await renounceSignerDefaultAdminRoleIfRequired()
})
