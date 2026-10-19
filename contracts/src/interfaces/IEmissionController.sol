// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IEmissionController {
    function claimLossReward(bytes32 marketId, address user, uint256 realizedLoss)
        external
        returns (uint256 paperMinted);

    function previewEmission(uint256 cumulativeLossBefore, uint256 realizedLoss)
        external
        view
        returns (uint256 paperMinted);

    function cumulativeRealizedLoss() external view returns (uint256);

    function cumulativePaperMinted() external view returns (uint256);
}
