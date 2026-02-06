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
| **StockShieldHook** | `0x70FC6bDE4c265bd00b6fC75A8582f8cD90307Ac0` |
| **GapAuction** | `0x77A0bC2C6F53B55025924DaC173a3F92777dade5` |
| **MarginVault** | `0x7cA67B708B29a019F52576896Ff86b3Adf7b8Ca5` |
| **DynamicFeeSetup** | `0x669D676703ebF28769bc863E089fCF0C36bB3D90` |

**Deployed:** February 6, 2026 | **Chain ID:** 11155111

### Mock Tokens (Sepolia Testnet)

All tokens have a public `faucet()` function for testing:

| Token | Symbol | Address |
|-------|--------|---------|
| **Mock USDC** | USDC | `0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70` |
| **Tokenized Apple** | tAAPL | `0x7D5A3d5C66a4422E3AFf7860e3bE709585068298` |
| **Tokenized Tesla** | tTSLA | `0x9935de3B97C2154e5dF32C9D2FEcA276e9f30896` |
| **Tokenized NVIDIA** | tNVDA | `0xC836831e6e72D9C98e46799C830C2Ac75daC2471` |
| **Tokenized Google** | tGOOGL | `0x21Fbe2d4f6c87315381176B14B99a36276DE971f` |
| **Tokenized Microsoft** | tMSFT | `0x4BefeAeBba1EefA79748146eCc9c2204613e3CbB` |

## Documentation

- [Foundry Book](https://book.getfoundry.sh/)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)

## License

MIT
