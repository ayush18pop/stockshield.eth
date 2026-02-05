# StockShield Contracts

Smart contracts for StockShield - a time-regime-aware AMM for tokenized securities built on Uniswap v4.

## Project Structure

```
contracts/
├── foundry.toml          # Foundry configuration
├── lib/                  # External dependencies (installed via forge)
│   ├── forge-std/        # Foundry standard library
│   ├── v4-core/          # Uniswap v4 core contracts
│   └── openzeppelin-contracts/  # OpenZeppelin contracts
├── script/               # Deployment scripts
│   └── Deploy.s.sol      # Main deployment script
├── src/                  # Source contracts
│   ├── interfaces/       # Contract interfaces
│   │   ├── IGapAuction.sol
│   │   ├── IMarginVault.sol
│   │   ├── IRegimeOracle.sol
│   │   ├── IStockShieldHook.sol
│   │   └── IStockShieldResolver.sol
│   ├── GapAuction.sol    # Commit-reveal auction for gap capture
│   ├── MarginVault.sol   # LP collateral & state channel management
│   ├── RegimeOracle.sol  # NYSE trading hours regime detection
│   ├── StockShieldHook.sol      # Main Uniswap v4 hook
│   └── StockShieldResolver.sol  # ENS resolver & reputation
└── test/                 # Test files
    └── StockShield.t.sol # Main test suite
```

## Installation

1. Install Foundry:

```shell
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

1. Install dependencies:

```shell
forge install foundry-rs/forge-std
forge install Uniswap/v4-core
forge install OpenZeppelin/openzeppelin-contracts
```

## Usage

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Format

```shell
forge fmt
```

### Gas Snapshots

```shell
forge snapshot
```

### Anvil (Local Node)

```shell
anvil
```

### Deploy

```shell
# Set environment variables
export GOVERNANCE_ADDRESS=<governance_address>
export CLEARNODE_ADDRESS=<clearnode_address>
export COLLATERAL_TOKEN_ADDRESS=<token_address>
export POOL_MANAGER_ADDRESS=<uniswap_pool_manager>

# Deploy
forge script script/Deploy.s.sol:DeployStockShield --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast
```

## Contracts Overview

| Contract | Description |
|----------|-------------|
| **StockShieldHook** | Main Uniswap v4 hook implementing time-regime-aware dynamic fees, circuit breakers, and gap auction integration |
| **RegimeOracle** | Determines market regime (Core Session, Pre-Market, After-Hours, etc.) based on NYSE trading hours |
| **MarginVault** | Manages LP collateral and Yellow Network state channel settlements |
| **GapAuction** | Commit-reveal auction mechanism for capturing overnight gap value |
| **StockShieldResolver** | ENS resolver for vault naming and trader reputation-based fee tiers |

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| **PoolManager** (Uniswap V4) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| **RegimeOracle** | `0xCC46a9e6FFB834a7a1C126f9D4e803bF418CccA6` |
| **StockShieldHook** | `0x9F724ceb362016f8B4B93A96EF93Ce8AdEfc3ac0` |
| **GapAuction** | `0x0bb31dd5939c625b70a3c209c3B278EacA202a02` |
| **MarginVault** | `0x609819C1e511B1537F1603f8eDdA622C05E59929` |
| **DynamicFeeSetup** | `0xfFe3553B6142A6E95e51bfaD727cDECB18393418` |

**Deployed:** February 6, 2026 | **Chain ID:** 11155111

### Mock Tokens (Sepolia Testnet)

All tokens have a public `faucet()` function for testing:

| Token | Symbol | Address |
|-------|--------|---------|
| **Mock USDC** | USDC | `0xc9b62Ff3Ca454a31f7107EDc5CA013c713f5eA4B` |
| **Tokenized Apple** | tAAPL | `0xA7c512e81963a4907AF5729EabC4Ddf321205Cde` |
| **Tokenized Tesla** | tTSLA | `0xb6Df0585Fa15bfa0c942D8C175532CDbc3104fb3` |
| **Tokenized NVIDIA** | tNVDA | `0x372712995Fc96F259dE6E1A6f74F06B10E6A6063` |
| **Tokenized Google** | tGOOGL | `0xBe88F14d6993057D8048cCdfde5981dab34d05f0` |
| **Tokenized Microsoft** | tMSFT | `0x1C1C3974d35304396cDD93136bfAD06b13E65AB3` |

## Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)

## License

MIT
