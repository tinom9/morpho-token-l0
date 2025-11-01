// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// OApp imports
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { RateLimiter } from "@layerzerolabs/oapp-evm/contracts/oapp/utils/RateLimiter.sol";

// OFT imports
import { IOFT, SendParam, OFTLimit } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";

// OZ imports
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Forge imports
import { console } from "forge-std/console.sol";

// DevTools imports
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

// Project imports
import { MorphoOFTAdapter } from "../../contracts/MorphoOFTAdapter.sol";
import { MorphoMintBurnOFTAdapter } from "../../contracts/MorphoMintBurnOFTAdapter.sol";
import { MorphoToken } from "../../contracts/MorphoToken.sol";

contract AdaptersTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private aEid = 1;
    uint32 private bEid = 2;
    uint32 private cEid = 3;

    MorphoToken private aToken;
    MorphoToken private bToken;
    MorphoToken private cToken;

    MorphoOFTAdapter private aAdapter;
    MorphoMintBurnOFTAdapter private bMaba;
    MorphoMintBurnOFTAdapter private cMaba;

    uint256 private alicePk = 1;
    uint256 private bobPk = 2;
    uint256 private charliePk = 3;

    address private alice = vm.addr(alicePk);
    address private bob = vm.addr(bobPk);
    address private charlie = vm.addr(charliePk);

    /// @dev Rate limit amount from A to B and back.
    uint192 private bRateLimit = 250_000 ether;
    /// @dev Rate limit amount from A to C and back.
    uint192 private cRateLimit = 500_000 ether;
    /// @dev Default rate limit to not enforce rate limit.
    uint192 private noRateLimit = type(uint192).max;

    uint256 private aliceBalance = 300_000 ether;
    uint256 private charlieBalance = 1_000_000 ether;

    uint256 private dustDivisor = 1e12;

    function setUp() public virtual override {
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(charlie, 1_000 ether);

        super.setUp();
        setUpEndpoints(3, LibraryType.UltraLightNode);

        /// @dev Token A.
        bytes memory tokenInitData = abi.encodeWithSelector(
            MorphoToken.initialize.selector,
            "Morpho Token",
            "MORPHO",
            address(this)
        );
        MorphoToken aTokenImpl = new MorphoToken();
        ERC1967Proxy aTokenProxy = new ERC1967Proxy(address(aTokenImpl), tokenInitData);
        aToken = MorphoToken(address(aTokenProxy));

        RateLimiter.RateLimitConfig[] memory aRateLimitConfigs = new RateLimiter.RateLimitConfig[](2);
        aRateLimitConfigs[0] = RateLimiter.RateLimitConfig(bEid, bRateLimit, 30 days);
        aRateLimitConfigs[1] = RateLimiter.RateLimitConfig(cEid, cRateLimit, 30 days);

        aAdapter = new MorphoOFTAdapter(address(aToken), endpoints[aEid], address(this), aRateLimitConfigs);

        /// @dev Token B.
        MorphoToken bTokenImpl = new MorphoToken();
        ERC1967Proxy bTokenProxy = new ERC1967Proxy(address(bTokenImpl), tokenInitData);
        bToken = MorphoToken(address(bTokenProxy));

        RateLimiter.RateLimitConfig[] memory bRateLimitConfigs = new RateLimiter.RateLimitConfig[](2);
        bRateLimitConfigs[0] = RateLimiter.RateLimitConfig(aEid, bRateLimit, 30 days);
        bRateLimitConfigs[1] = RateLimiter.RateLimitConfig(cEid, noRateLimit, 30 days);

        bMaba = new MorphoMintBurnOFTAdapter(
            address(bToken),
            bToken,
            endpoints[bEid],
            address(this),
            bRateLimitConfigs
        );

        bToken.grantRole(bToken.MINTER_ROLE(), address(bMaba));
        bToken.grantRole(bToken.BURNER_ROLE(), address(bMaba));

        /// @dev Token C.
        MorphoToken cTokenImpl = new MorphoToken();
        ERC1967Proxy cTokenProxy = new ERC1967Proxy(address(cTokenImpl), tokenInitData);
        cToken = MorphoToken(address(cTokenProxy));

        RateLimiter.RateLimitConfig[] memory cRateLimitConfigs = new RateLimiter.RateLimitConfig[](2);
        cRateLimitConfigs[0] = RateLimiter.RateLimitConfig(aEid, cRateLimit, 30 days);
        cRateLimitConfigs[1] = RateLimiter.RateLimitConfig(bEid, noRateLimit, 30 days);

        cMaba = new MorphoMintBurnOFTAdapter(
            address(cToken),
            cToken,
            endpoints[cEid],
            address(this),
            cRateLimitConfigs
        );

        cToken.grantRole(cToken.MINTER_ROLE(), address(cMaba));
        cToken.grantRole(cToken.BURNER_ROLE(), address(cMaba));

        /// @dev Wiring.
        address[] memory ofts = new address[](3);
        ofts[0] = address(aAdapter);
        ofts[1] = address(bMaba);
        ofts[2] = address(cMaba);
        this.wireOApps(ofts);

        /// @dev Testing purposes.
        aToken.grantRole(aToken.MINTER_ROLE(), address(this));
        bToken.grantRole(bToken.MINTER_ROLE(), address(this));

        aToken.mint(alice, aliceBalance);
        bToken.mint(charlie, charlieBalance);

        vm.prank(alice);
        aToken.approve(address(aAdapter), type(uint256).max);
    }

    function _removeDust(uint256 amount) internal view returns (uint256) {
        return (amount / dustDivisor) * dustDivisor;
    }

    function _getSendParam(uint32 eid, address to, uint256 amount) internal view returns (SendParam memory sendParam) {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(100_000, 0);
        sendParam = SendParam(eid, addressToBytes32(to), amount, _removeDust(amount), options, "", "");
    }

    function _prepareSend(
        IOFT oft,
        uint32 eid,
        address to,
        uint256 amount
    ) internal view returns (SendParam memory sendParam, MessagingFee memory fee) {
        sendParam = _getSendParam(eid, to, amount);
        fee = oft.quoteSend(sendParam, false);
    }

    function test_send_Succeed_WithinRateLimit_AtoB() public {
        uint256 tokensToSend = bRateLimit;

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(aAdapter, bEid, bob, tokensToSend);

        vm.prank(alice);
        aAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        verifyPackets(bEid, addressToBytes32(address(bMaba)));

        assertEq(aToken.balanceOf(alice), aliceBalance - tokensToSend);
        assertEq(aToken.balanceOf(address(aAdapter)), tokensToSend);
        assertEq(bToken.balanceOf(bob), tokensToSend);
    }

    function test_send_Succeed_WithinRateLimit_BtoA() public {
        uint256 tokensToSend = bRateLimit;

        aToken.mint(address(aAdapter), tokensToSend);

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(bMaba, aEid, bob, tokensToSend);

        vm.prank(charlie);
        bMaba.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        verifyPackets(aEid, addressToBytes32(address(aAdapter)));

        assertEq(bToken.balanceOf(charlie), charlieBalance - tokensToSend);
        assertEq(bToken.balanceOf(address(bMaba)), 0);
        assertEq(aToken.balanceOf(bob), tokensToSend);
        assertEq(aToken.balanceOf(address(aAdapter)), 0);
    }

    function test_send_Succeed_NoRateLimit_BtoC() public {
        assertGt(charlieBalance, bRateLimit);
        assertGt(charlieBalance, cRateLimit);

        uint256 tokensToSend = charlieBalance;

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(bMaba, cEid, bob, tokensToSend);

        vm.prank(charlie);
        bMaba.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        verifyPackets(cEid, addressToBytes32(address(cMaba)));

        assertEq(bToken.balanceOf(charlie), 0);
        assertEq(bToken.balanceOf(address(bMaba)), 0);
        assertEq(cToken.balanceOf(bob), tokensToSend);
    }

    function testFuzz_send_Succeed_WithinRateLimit(uint256 tokensToSend) public {
        vm.assume(tokensToSend <= bRateLimit);
        vm.assume(tokensToSend >= dustDivisor);

        uint256 undustedTokensToSend = _removeDust(tokensToSend);

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(aAdapter, bEid, bob, tokensToSend);

        vm.prank(alice);
        aAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        verifyPackets(bEid, addressToBytes32(address(bMaba)));

        assertEq(aToken.balanceOf(alice), aliceBalance - undustedTokensToSend);
        assertEq(aToken.balanceOf(address(aAdapter)), undustedTokensToSend);
        assertEq(bToken.balanceOf(bob), undustedTokensToSend);
    }

    function test_send_Revert_ExceedsRateLimitOneTx() public {
        uint256 tokensToSend = aliceBalance;

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(aAdapter, bEid, bob, tokensToSend);

        vm.prank(alice);
        vm.expectRevert(RateLimiter.RateLimitExceeded.selector);
        aAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
    }

    function test_send_Revert_ExceedsRateLimitCumulative() public {
        uint256 tokensToSend = aliceBalance / 2;

        (SendParam memory sendParam, MessagingFee memory fee) = _prepareSend(aAdapter, bEid, bob, tokensToSend);

        vm.prank(alice);
        aAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));

        vm.prank(alice);
        vm.expectRevert(RateLimiter.RateLimitExceeded.selector);
        aAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
    }

    function test_setRateLimits_Succeed_UnsetExisting() public {
        RateLimiter.RateLimitConfig[] memory rateLimitConfigs = new RateLimiter.RateLimitConfig[](2);
        rateLimitConfigs[0] = RateLimiter.RateLimitConfig(bEid, bRateLimit, 30 days);
        rateLimitConfigs[1] = RateLimiter.RateLimitConfig(cEid, noRateLimit, 30 days);
        aAdapter.setRateLimits(rateLimitConfigs);
    }

    function test_setRateLimits_Succeed_SetNew() public {
        RateLimiter.RateLimitConfig[] memory rateLimitConfigs = new RateLimiter.RateLimitConfig[](2);
        rateLimitConfigs[0] = RateLimiter.RateLimitConfig(aEid, bRateLimit, 30 days);
        rateLimitConfigs[1] = RateLimiter.RateLimitConfig(cEid, cRateLimit, 30 days);
        bMaba.setRateLimits(rateLimitConfigs);
    }

    function test_quoteOFT_ReturnAvailableRateLimit_Adapter() public view {
        SendParam memory sendParam = _getSendParam(bEid, bob, 0);

        (OFTLimit memory oftLimit, , ) = aAdapter.quoteOFT(sendParam);

        assertEq(oftLimit.maxAmountLD, bRateLimit);
    }

    function test_quoteOFT_ReturnAvailableRateLimit_Maba() public view {
        SendParam memory sendParam = _getSendParam(aEid, bob, 0);

        (OFTLimit memory oftLimit, , ) = bMaba.quoteOFT(sendParam);

        assertEq(oftLimit.maxAmountLD, bRateLimit);
    }

    function test_quoteOFT_ReturnAvailableRateLimit_NoRateLimit() public view {
        SendParam memory sendParam = _getSendParam(cEid, bob, 0);

        (OFTLimit memory oftLimit, , ) = bMaba.quoteOFT(sendParam);

        assertEq(oftLimit.maxAmountLD, noRateLimit);
    }
}
