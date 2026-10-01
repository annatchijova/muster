// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title CapacityMarket
/// @notice Onchain market for future specialist response capacity.
///
/// A CapacityPosition represents a provider's commitment to deliver `quantity`
/// units of work in a given `domain`, usable within [validFrom, validUntil],
/// with a bounded acknowledgement time (`activationSLA`) if the buyer activates it.
///
/// What this contract guarantees onchain (the load-bearing invariants):
///   1. No double reservation: a position has exactly one buyer at a time, and
///      `reserve` only succeeds from `Listed`.
///   2. No double consumption: `activate`/`acceptActivation`/`settle` each
///      require the exact prior state; a position cannot be consumed twice.
///   3. Transfer preserves the asset: `validUntil`, `activationSLA`, and
///      `collateral` are immutable after listing. Transfer changes `buyer`
///      only.
///   4. Collateral is locked at listing and released exactly once, either to
///      the provider at `settle` or to the buyer at `claimDefault`.
///   5. State transitions are one-way. There is no path back to an earlier
///      state, so a stale reference to a position's status is never wrong
///      about what remains possible from here.
///
/// What this contract does NOT and cannot guarantee: that the provider was
/// actually available, or that the delivered work met the buyer's bar. Those
/// require an offchain attestation/dispute process layered on top of
/// `settle`/`claimDefault` — see docs/TECHNICAL_README.md "Trust boundary".
contract CapacityMarket {
    enum Status {
        Listed,
        Reserved,
        Activated,
        Accepted,
        Settled,
        Expired,
        Defaulted
    }

    struct CapacityPosition {
        bytes32 domain;
        uint256 quantity;
        uint64 validFrom;
        uint64 validUntil;
        uint64 activationSLA;
        address provider;
        address buyer;
        uint256 price;
        uint256 collateral;
        uint64 activationDeadline;
        Status status;
    }

    uint256 public nextPositionId;
    mapping(uint256 => CapacityPosition) public positions;

    event Listed(
        uint256 indexed positionId,
        address indexed provider,
        bytes32 domain,
        uint256 quantity,
        uint64 validFrom,
        uint64 validUntil,
        uint64 activationSLA,
        uint256 price,
        uint256 collateral
    );
    event Reserved(uint256 indexed positionId, address indexed buyer);
    event Transferred(uint256 indexed positionId, address indexed from, address indexed to);
    event Activated(uint256 indexed positionId, uint64 activationDeadline);
    event Accepted(uint256 indexed positionId);
    event Settled(uint256 indexed positionId);
    event Expired(uint256 indexed positionId);
    event Defaulted(uint256 indexed positionId);

    error NotProvider();
    error NotBuyer();
    error WrongStatus(Status expected, Status actual);
    error WrongValue();
    error WindowNotOpen();
    error WindowClosed();
    error WindowNotYetClosed();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error InvalidWindow();

    modifier inStatus(uint256 positionId, Status expected) {
        Status actual = positions[positionId].status;
        if (actual != expected) revert WrongStatus(expected, actual);
        _;
    }

    /// @notice Provider lists capacity, posting `collateral` as a bond against default.
    function listCapacity(
        bytes32 domain,
        uint256 quantity,
        uint64 validFrom,
        uint64 validUntil,
        uint64 activationSLA,
        uint256 price
    ) external payable returns (uint256 positionId) {
        if (validUntil <= validFrom) revert InvalidWindow();
        if (quantity == 0) revert WrongValue();

        positionId = nextPositionId++;
        positions[positionId] = CapacityPosition({
            domain: domain,
            quantity: quantity,
            validFrom: validFrom,
            validUntil: validUntil,
            activationSLA: activationSLA,
            provider: msg.sender,
            buyer: address(0),
            price: price,
            collateral: msg.value,
            activationDeadline: 0,
            status: Status.Listed
        });

        emit Listed(positionId, msg.sender, domain, quantity, validFrom, validUntil, activationSLA, price, msg.value);
    }

    /// @notice Buyer reserves a listed position, paying exactly `price`.
    function reserve(uint256 positionId) external payable inStatus(positionId, Status.Listed) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp >= p.validUntil) revert WindowClosed();
        if (msg.value != p.price) revert WrongValue();

        p.buyer = msg.sender;
        p.status = Status.Reserved;

        emit Reserved(positionId, msg.sender);
    }

    /// @notice Current buyer transfers the reservation to `to`. The underlying
    /// asset (window, SLA, collateral) does not change — only ownership of the
    /// right to activate it.
    function transfer(uint256 positionId, address to) external inStatus(positionId, Status.Reserved) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();
        if (block.timestamp >= p.validUntil) revert WindowClosed();

        p.buyer = to;
        emit Transferred(positionId, msg.sender, to);
    }

    /// @notice Anyone may close out a reservation that was never activated
    /// before its window closed. Capacity is not consumed; it just lapses.
    function expire(uint256 positionId) external inStatus(positionId, Status.Reserved) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp < p.validUntil) revert WindowNotYetClosed();

        p.status = Status.Expired;
        emit Expired(positionId);

        _payout(p.provider, p.collateral);
    }

    /// @notice Buyer activates the position, starting the provider's
    /// acknowledgement clock.
    function activate(uint256 positionId) external inStatus(positionId, Status.Reserved) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();
        if (block.timestamp < p.validFrom || block.timestamp >= p.validUntil) revert WindowNotOpen();

        p.activationDeadline = uint64(block.timestamp) + p.activationSLA;
        p.status = Status.Activated;

        emit Activated(positionId, p.activationDeadline);
    }

    /// @notice Provider acknowledges the activation within the SLA.
    function acceptActivation(uint256 positionId) external inStatus(positionId, Status.Activated) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.provider) revert NotProvider();
        if (block.timestamp > p.activationDeadline) revert DeadlinePassed();

        p.status = Status.Accepted;
        emit Accepted(positionId);
    }

    /// @notice Anyone may trigger default once the provider missed the
    /// acknowledgement deadline. Collateral compensates the buyer.
    function claimDefault(uint256 positionId) external inStatus(positionId, Status.Activated) {
        CapacityPosition storage p = positions[positionId];
        if (block.timestamp <= p.activationDeadline) revert DeadlineNotPassed();

        p.status = Status.Defaulted;
        emit Defaulted(positionId);

        _payout(p.buyer, p.collateral);
    }

    /// @notice Buyer confirms delivery. Price and collateral both release to
    /// the provider; this is the only path that pays the provider the price.
    function settle(uint256 positionId) external inStatus(positionId, Status.Accepted) {
        CapacityPosition storage p = positions[positionId];
        if (msg.sender != p.buyer) revert NotBuyer();

        p.status = Status.Settled;
        emit Settled(positionId);

        _payout(p.provider, p.price + p.collateral);
    }

    // `to` is always `p.provider` or `p.buyer` read from storage at the call
    // site, never an address passed directly by the caller of the public
    // function — so this is not an arbitrary-send-eth sink despite the lint.
    function _payout(address to, uint256 amount) private {
        if (amount == 0) return;
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        require(ok, "payout failed");
    }
}
