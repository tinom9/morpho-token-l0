import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { getHreByNetworkName } from '@layerzerolabs/devtools-evm-hardhat'

export async function executeMultiNetworkTask(
    hre: HardhatRuntimeEnvironment,
    task: (hre: HardhatRuntimeEnvironment) => Promise<void>,
    networkNames: string[]
) {
    const networkConfigs = networkNames.map((networkName: string) => hre.config.networks[networkName])
    const missingNetworkNames = networkNames.filter((_: string, i: number) => networkConfigs[i] === undefined)
    if (missingNetworkNames.length > 0) {
        console.error(`Missing networks: ${missingNetworkNames.join(', ')}`)
        return
    }

    const networkHres = await Promise.all(networkNames.map((networkName: string) => getHreByNetworkName(networkName)))

    await Promise.all(
        networkHres.map(async (networkHre: HardhatRuntimeEnvironment) => {
            try {
                await task(networkHre)
            } catch (error) {
                console.error(`Error executing for ${networkHre.network.name}: ${error}`)
            }
        })
    )
}
