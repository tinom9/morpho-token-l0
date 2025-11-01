import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'

import { CONTRACTS, getConfirmations, getEnforcedOptions, getOwnerAddress } from './consts/mainnet'

async function generateConnections() {
    const pathways: TwoWayConfig[] = []
    for (let i = 0; i < CONTRACTS.length; i++) {
        for (let j = i + 1; j < CONTRACTS.length; j++) {
            const [from, to] = [CONTRACTS[i], CONTRACTS[j]]
            pathways.push([
                from, // Chain A contract
                to, // Chain B contract
                [
                    ['LayerZero Labs', 'Canary'],
                    [['Deutsche Telekom', 'P2P'], 1],
                ], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
                [getConfirmations(from.eid), getConfirmations(to.eid)], // [A to B confirmations, B to A confirmations]
                [getEnforcedOptions(to.eid), getEnforcedOptions(from.eid)], // Chain B enforcedOptions, Chain A enforcedOptions
            ])
        }
    }
    return await generateConnectionsConfig(pathways)
}

export default async function () {
    return {
        contracts: CONTRACTS.map((contract) => ({
            contract,
            config: {
                owner: getOwnerAddress(contract.eid),
                delegate: getOwnerAddress(contract.eid),
            },
        })),
        connections: await generateConnections(),
    }
}
