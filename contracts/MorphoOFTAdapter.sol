// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { OFTCore } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";
import { SendParam, OFTLimit, OFTFeeDetail, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

/**
 * @title MorphoOFTAdapter
 * @notice OFT adapter with outbound rate limiting.
 */
contract MorphoOFTAdapter is OFTAdapter, RateLimiter {
    using SafeERC20 for IERC20;

    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate,
        RateLimitConfig[] memory _rateLimitConfigs
    ) OFTAdapter(_token, _lzEndpoint, _delegate) Ownable(_delegate) {
        _setRateLimits(_rateLimitConfigs);
    }

    /**
     * @notice Set an array of rate limit configurations.
     * @param _rateLimitConfigs Rate limit configurations
     */
    function setRateLimits(RateLimitConfig[] memory _rateLimitConfigs) external onlyOwner {
        _setRateLimits(_rateLimitConfigs);
    }

    /**
     * @notice Resets the rate limits (sets amountInFlight to 0) for the given endpoint ids.
     * @param _eids The endpoint ids to reset the rate limits for.
     */
    function resetRateLimits(uint32[] memory _eids) external onlyOwner {
        _resetRateLimits(_eids);
    }

    /**
     * @dev Override to apply outbound rate limit.
     * @inheritdoc OFTAdapter
     */
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        /// @dev Apply outbound rate limit for the destination EID.
        _outflow(_dstEid, amountReceivedLD);
        innerToken.safeTransferFrom(_from, address(this), amountSentLD);
    }

    /**
     * @dev Override to get the max amount that can be sent due to rate limits.
     *      Only the `maxAmountLD` value is overridden, the rest remains unchanged.
     * @inheritdoc OFTCore
     */
    function quoteOFT(
        SendParam calldata _sendParam
    )
        external
        view
        virtual
        override
        returns (OFTLimit memory oftLimit, OFTFeeDetail[] memory oftFeeDetails, OFTReceipt memory oftReceipt)
    {
        uint256 minAmountLD = 0;

        /// @dev Override `maxAmountLD`.
        (, uint256 maxAmountLD) = getAmountCanBeSent(_sendParam.dstEid);
        oftLimit = OFTLimit(minAmountLD, maxAmountLD);

        oftFeeDetails = new OFTFeeDetail[](0);

        (uint256 amountSentLD, uint256 amountReceivedLD) = _debitView(
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );
        oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);
    }
}
