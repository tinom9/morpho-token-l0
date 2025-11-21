import assert from 'assert'

import { HardhatRuntimeEnvironment } from 'hardhat/types'

export async function validateHre(hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments

    const eid = hre.network.config.eid

    const { deployer } = await getNamedAccounts()

    assert(eid, 'EID not set on network config')

    assert(deployer, 'Missing named deployer account')

    return { eid, deployer, deployments, deploy }
}
