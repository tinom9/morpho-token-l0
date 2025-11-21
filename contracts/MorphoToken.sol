// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC1967Utils } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import { IMintableBurnable } from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";

contract MorphoToken is ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable, IMintableBurnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    constructor() {
        _disableInitializers();
    }

    function initialize(string memory _name, string memory _symbol, address _owner) external initializer {
        __ERC20_init(_name, _symbol);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(MINTER_ROLE, _owner);
        _grantRole(BURNER_ROLE, _owner);
        _grantRole(UPGRADER_ROLE, _owner);

        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(UPGRADER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @notice Mints a specific amount of tokens to a given address.
     *
     *
     * @param _to The address to which tokens will be minted.
     * @param _amount The amount of tokens to mint.
     *
     * @return A boolean indicating the success of the mint operation.
     */
    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    /**
     * @notice Burns a specific amount of tokens from a given address.
     *
     *
     * @param _from The address from which tokens will be burned.
     * @param _amount The amount of tokens to burn.
     *
     * @return A boolean indicating the success of the burn operation.
     */
    function burn(address _from, uint256 _amount) external onlyRole(BURNER_ROLE) returns (bool) {
        _burn(_from, _amount);
        return true;
    }

    /// @notice Returns the contract's current implementation address.
    function getImplementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
