import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { OAppEnforcedOption } from '@layerzerolabs/toolbox-hardhat'

type RateLimitConfig = {
    dstEid: EndpointId
    limit: BigNumber
    window: BigNumber
}

export const CONTRACTS = [
    { eid: EndpointId.ETHEREUM_V2_MAINNET, contractName: 'MorphoOFTAdapter' },
    { eid: EndpointId.ARBITRUM_V2_MAINNET, contractName: 'MorphoMintBurnOFTAdapter' },
    { eid: EndpointId.HYPERLIQUID_V2_MAINNET, contractName: 'MorphoMintBurnOFTAdapter' },
]

const NETWORKS: EndpointId[] = CONTRACTS.map((contract) => contract.eid)

// Chain default confirmations.
const CONFIRMATIONS: Partial<Record<EndpointId, number>> = {
    [EndpointId.ETHEREUM_V2_MAINNET]: 15,
    [EndpointId.ARBITRUM_V2_MAINNET]: 20,
    [EndpointId.HYPERLIQUID_V2_MAINNET]: 1,
}

const DEFAULT_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 100_000, value: 0 },
    // Additional variable gas needs to be passed as an option on compose OFT sends due
    // to the variable compose message size.
    { msgType: 2, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 130_000, value: 0 },
]

const ENFORCED_OPTIONS: Partial<Record<EndpointId, OAppEnforcedOption[]>> = {
    [EndpointId.ETHEREUM_V2_MAINNET]: [
        { msgType: 1, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 70_000, value: 0 },
        { msgType: 2, optionType: ExecutorOptionType.LZ_RECEIVE, gas: 97_000, value: 0 },
    ],
    [EndpointId.ARBITRUM_V2_MAINNET]: DEFAULT_ENFORCED_OPTIONS,
    [EndpointId.HYPERLIQUID_V2_MAINNET]: DEFAULT_ENFORCED_OPTIONS,
}

const OWNERS: Partial<Record<EndpointId, string>> = {
    [EndpointId.ETHEREUM_V2_MAINNET]: '0xcBa28b38103307Ec8dA98377ffF9816C164f9AFa',
    [EndpointId.ARBITRUM_V2_MAINNET]: '0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2',
    [EndpointId.HYPERLIQUID_V2_MAINNET]: '0x34EdAe4f1Fd1b5947f6bE560ca371a56042daCbA',
}

const THIRTY_DAYS_IN_SECONDS = BigNumber.from(30 * 24 * 60 * 60) // 2,592,000 seconds.

// Convert to token unit (wei).
const toUnit = (amount: number) => {
    return parseEther(amount.toString())
}

// `type(uint192).max`.
const MAX_RATE_LIMIT = BigNumber.from(2).pow(192).sub(1)

const DEFAULT_RATE_LIMIT: Omit<RateLimitConfig, 'dstEid'> = {
    limit: MAX_RATE_LIMIT,
    window: THIRTY_DAYS_IN_SECONDS,
}

// One-way outbound rate limits.
const RATE_LIMITS: Partial<Record<EndpointId, RateLimitConfig[]>> = {
    [EndpointId.ETHEREUM_V2_MAINNET]: [
        {
            dstEid: EndpointId.ARBITRUM_V2_MAINNET,
            limit: toUnit(250_000),
            window: THIRTY_DAYS_IN_SECONDS,
        },
        {
            dstEid: EndpointId.HYPERLIQUID_V2_MAINNET,
            limit: toUnit(500_000),
            window: THIRTY_DAYS_IN_SECONDS,
        },
    ],
    [EndpointId.ARBITRUM_V2_MAINNET]: [
        {
            dstEid: EndpointId.ETHEREUM_V2_MAINNET,
            limit: toUnit(100_000),
            window: THIRTY_DAYS_IN_SECONDS,
        },
    ],
    [EndpointId.HYPERLIQUID_V2_MAINNET]: [
        {
            dstEid: EndpointId.ETHEREUM_V2_MAINNET,
            limit: toUnit(500_000),
            window: THIRTY_DAYS_IN_SECONDS,
        },
    ],
}

export const getConfirmations = (eid: EndpointId): number => {
    return CONFIRMATIONS[eid] ?? 0
}

export const getEnforcedOptions = (eid: EndpointId): OAppEnforcedOption[] => {
    return ENFORCED_OPTIONS[eid] ?? DEFAULT_ENFORCED_OPTIONS
}

export const getOwnerAddress = (eid: EndpointId): string => {
    const address = OWNERS[eid]
    if (!address || address === 'TODO' || address === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Owner address not configured for endpoint ${eid}`)
    }
    return address
}

export const getRateLimits = (eid: EndpointId) => {
    const rateLimits = RATE_LIMITS[eid] ?? []
    // Return default rate limits for all networks if not explicitly set.
    for (const network of NETWORKS) {
        if (eid !== network && !rateLimits.some((limit) => limit.dstEid === network)) {
            rateLimits.push({ dstEid: network, ...DEFAULT_RATE_LIMIT })
        }
    }
    // Validate rate limits.
    for (const rateLimit of rateLimits) {
        if (rateLimit.limit.gt(MAX_RATE_LIMIT)) {
            throw new Error(`Rate limit for ${rateLimit.dstEid} is too high`)
        }
    }
    return rateLimits
}

export const getOFTContractName = (eid: EndpointId) => {
    const contractName = CONTRACTS.find((contract) => contract.eid === eid)?.contractName
    if (!contractName) throw new Error(`Contract name not configured for EID ${eid}`)
    return contractName
}

/**
 * MORPHO token address on Ethereum mainnet.
 *
 * https://etherscan.io/address/0x58D97B57BB95320F9a05dC918Aef65434969c2B2
 */
export const ETHEREUM_MORPHO_TOKEN_ADDRESS = '0x58D97B57BB95320F9a05dC918Aef65434969c2B2'
