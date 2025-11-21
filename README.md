<p align="center">
  <a href="https://layerzero.network">
    <img alt="LayerZero" style="width: 400px" src="https://docs.layerzero.network/img/LayerZero_Logo_Black.svg"/>
  </a>
</p>

<p align="center">
 <a href="https://docs.layerzero.network/" style="color: #a77dff">LayerZero Docs</a>
</p>

<h1 align="center">Morpho Contracts</h1>

## Overview

Morpho token contracts for non-Ethereum networks, and OFT adapters.

- `MorphoOFTAdapter`: deployed in Ethereum as a lockbox adapter.
- `MorphoTokenArbitrum`: deployed in Arbitrum as the Morpho token.
- `MorphoToken`: deployed in other EVM networks as the Morpho token.
- `MorphoMintBurnOFTAdapter`: deployed in non-Ethereum EVM networks as a mint-and-burn adapter with minter and burner permissions to the Morpho token of the network.

## Deployment

```bash
pnpm compile

pnpm hardhat lz:deploy --networks ethereum --tags MorphoOFTAdapter --ci

pnpm hardhat lz:deploy --networks arbitrum,hyperevm --tags MorphoToken --ci
pnpm hardhat lz:deploy --networks arbitrum,hyperevm --tags MorphoMintBurnOFTAdapter --ci

pnpm hardhat lz:set-rate-limits --networks ethereum,arbitrum,hyperevm

pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts

pnpm hardhat lz:ownable:transfer-ownership --oapp-config layerzero.config.ts

pnpm hardhat lz:transfer-erc20-admin-role --network hyperevm
```
