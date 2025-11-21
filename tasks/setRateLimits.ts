import assert from 'assert'

import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { getOFTContractName, getRateLimits } from '../consts/mainnet'
import { validateHre } from '../utils/hre'
import { executeMultiNetworkTask } from '../utils/multiNetworkTask'

import { LZ_SET_RATE_LIMITS_TASK } from './names'

type RateLimitRaw = [BigNumber, BigNumber, BigNumber, BigNumber]

type RateLimit = {
    amountInFlight: BigNumber
    lastUpdated: BigNumber
    limit: BigNumber
    window: BigNumber
}

function parseRateLimit(rateLimitRaw: RateLimitRaw): RateLimit {
    return {
        amountInFlight: rateLimitRaw[0],
        lastUpdated: rateLimitRaw[1],
        limit: rateLimitRaw[2],
        window: rateLimitRaw[3],
    }
}

export const setRateLimits = async (hre: HardhatRuntimeEnvironment) => {
    const { eid, deployments } = await validateHre(hre)

    const contractName = getOFTContractName(eid)

    assert(contractName, `Contract name not configured for endpoint ${eid}`)

    const oftDeployment = await deployments.get(contractName)
    const oftFactory = await hre.ethers.getContractFactory(contractName)
    const oft = oftFactory.attach(oftDeployment.address)

    const rateLimitConfigs = getRateLimits(eid)

    const rateLimitsSetRaw = await Promise.all(rateLimitConfigs.map(({ dstEid }) => oft.rateLimits(dstEid)))
    const rateLimitsSet = rateLimitsSetRaw.map(parseRateLimit)
    const rateLimitsSetByEid = rateLimitsSet.reduce(
        (acc, rateLimit, i) => {
            acc[rateLimitConfigs[i].dstEid] = rateLimit
            return acc
        },
        {} as Partial<Record<EndpointId, RateLimit>>
    )

    let needsUpdate = false

    for (const rateLimitConfigDesired of rateLimitConfigs) {
        const rateLimitSet = rateLimitsSetByEid[rateLimitConfigDesired.dstEid]!

        const { limit: limitSet, window: windowSet } = rateLimitSet
        const { limit: limitDesired, window: windowDesired } = rateLimitConfigDesired

        if (limitSet.eq(limitDesired) && windowSet.eq(windowDesired)) continue

        console.log(
            `Rate limit set in ${hre.network.name} for ${rateLimitConfigDesired.dstEid}` +
                `({ limit: ${limitSet.toString()}, window: ${windowSet.toString()} }) ` +
                `mismatches desired rate limit ` +
                `({ limit: ${limitDesired.toString()}, window: ${windowDesired.toString()} })`
        )
        needsUpdate = true
    }

    if (!needsUpdate) {
        console.log(`No rate limits need to be updated for ${hre.network.name}`)
        return
    }

    const tx = await oft.setRateLimits(rateLimitConfigs)
    console.log(`Set rate limits TX send ${tx.hash}`)

    await tx.wait()
    console.log(`Rate limits set for ${hre.network.name}`)
}

task(LZ_SET_RATE_LIMITS_TASK, 'Set specified rate limits for the contracts')
    .addOptionalParam('networks', 'Comma-separated list of networks to grant roles on')
    .setAction(async ({ networks }, hre) => {
        const networkNames = networks
            ? networks.split(',').map((networkName: string) => networkName.trim())
            : [hre.network.name]

        await executeMultiNetworkTask(hre, setRateLimits, networkNames)
    })
