// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title CapacityPool
/// @notice Fungible market for future specialist response capacity: Level 2
/// of MUSTER, built on top of the same lifecycle `CapacityMarket` (Level 1)
/// uses for a single provider's position, generalized to many providers
/// contributing interchangeable capacity to the same terms class.
///
/// A TermsClass (domain, window, activation SLA, dispute window, price/unit,
/// collateral/unit) defines what makes units fungible with each other.
/// Providers contribute quantity to a class; buyers reserve quantity from
/// the class without choosing a provider. Routing happens at `activate()`
/// time: the contract assigns whichever contributions are oldest-first
/// (FIFO) until the reserved quantity is covered, possibly splitting across
/// several providers. From there each assigned slice (`Assignment`) behaves
/// exactly like a `CapacityMarket` position: Pending -> Accepted ->
/// DeliveryClaimed -> Settled (buyer-approved, or anyone-callable once the
/// dispute window passes) or -> Disputed, or Pending -> Defaulted on an SLA
/// miss — independently of its siblings.
///
/// Level 1's invariants hold here too, at the unit of an Assignment instead
/// of a whole position (no double consumption, no double payout, transitions
/// one-way, a dispute window that defaults to paying the provider rather
/// than locking funds against a silent buyer). This contract adds the
/// Level-2-specific invariant named directly in the project's design notes:
///
///     reserved + assigned <= committed capacity
///
/// enforced by `reserve()` checking `available` before decrementing it, and
/// proven never to be violated by `activate()`'s FIFO walk — see
/// docs/TECHNICAL_README.md "Why activate() cannot run out of capacity".
///
/// Level 4/5 addition, mirroring `CapacityMarket`: a `TermsClass` may define
/// an arbitration panel (`panelMembers`/`panelThreshold`), shared by every
/// assignment drawn from that class, like `activationSLA`/`disputeWindow`.
/// An empty panel opts the whole class out. Once an assignment is
/// `Disputed`, any panel member may `voteAssignmentDispute`; once either
/// side's votes reach `panelThreshold`, that verdict executes. A single
/// trusted arbitrator (Level 4) is just the `panelMembers.length == 1,
/// panelThreshold == 1` case. `resolveAssignmentDisputeByTimeout` still
/// fires if the panel never reaches threshold — see
/// `CapacityMarket.voteDispute`'s NatSpec for the full reasoning.
contract CapacityPool {
    enum AssignmentStatus {
        Pending,
        Accepted,
        DeliveryClaimed,
        Disputed,
        Defaulted,
        Settled,
        Refunded
    }

    enum ReservationStatus {
        Reserved,
        Activated,
        Expired
    }

    enum DisputeVote {
        None,
        ProviderWins,
        BuyerWins
    }

    struct TermsClass {
        bytes32 domain;
        uint64 validFrom;
        uint64 validUntil;
        uint64 activationSLA;
        uint64 disputeWindow;
        address[] panelMembers;
        uint256 panelThreshold;
        uint256 pricePerUnit;
        uint256 collateralPerUnit;
    }

    struct Contribution {
        address provider;
        uint256 remaining;
    }

    struct PoolClass {
        TermsClass terms;
        bool initialized;
        uint256 totalCommitted;
        uint256 available;
        uint256 contribHead;
        Contribution[] contributions;
    }

    struct Assignment {
        address provider;
        uint256 quantity;
        uint256 price;
        uint256 collateral;
        bytes32 deliveryEvidenceHash;
        uint64 disputeDeadline;
        AssignmentStatus status;
    }

    struct Reservation {
        bytes32 classId;
        address buyer;
        uint256 quantity;
        uint64 activationDeadline;
        ReservationStatus status;
        Assignment[] assignments;
    }

    mapping(bytes32 => PoolClass) private pools;
    uint256 public nextReservationId;
    mapping(uint256 => Reservation) private reservations;

    mapping(uint256 => mapping(uint256 => mapping(address => DisputeVote))) private disputeVotes;
    mapping(uint256 => mapping(uint256 => uint256)) private providerVoteCount;
    mapping(uint256 => mapping(uint256 => uint256)) private buyerVoteCount;

    event Contributed(bytes32 indexed classId, address indexed provider, uint256 quantity, uint256 collateral);
    event Reserved(uint256 indexed reservationId, bytes32 indexed classId, address indexed buyer, uint256 quantity);
    event ReservationTransferred(uint256 indexed reservationId, address indexed from, address indexed to);
    event ReservationExpired(uint256 indexed reservationId);
    event ReservationActivated(uint256 indexed reservationId, uint64 activationDeadline, uint256 assignmentCount);
    event AssignmentAccepted(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider);
    event AssignmentDeliveryClaimed(
        uint256 indexed reservationId, uint256 indexed assignmentIndex, bytes32 evidenceHash, uint64 disputeDeadline
    );
    event AssignmentDisputed(
        uint256 indexed reservationId, uint256 indexed assignmentIndex, bytes32 reasonHash, uint64 resolutionDeadline
    );
    event AssignmentDefaulted(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider);
    event AssignmentSettled(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed provider);
    event AssignmentRefunded(uint256 indexed reservationId, uint256 indexed assignmentIndex, address indexed buyer);
    event AssignmentDisputeVoteCast(
        uint256 indexed reservationId,
        uint256 indexed assignmentIndex,
        address indexed voter,
        bool providerWins,
        uint256 providerVotes,
        uint256 buyerVotes
    );
    event AssignmentDisputeResolved(uint256 indexed reservationId, uint256 indexed assignmentIndex, bool providerWon);
    event ContributionWithdrawn(bytes32 indexed classId, uint256 indexed index, address indexed provider, uint256 amount);

    error InvalidWindow();
    error WrongValue();
    error InsufficientAvailableCapacity();
    error NotBuyer();
    error NotProvider();
    error NotArbitrator();
    error InvalidPanel();
    error AlreadyVoted();
    error WrongReservationStatus(ReservationStatus expected, ReservationStatus actual);
    error WrongAssignmentStatus(AssignmentStatus expected, AssignmentStatus actual);
    error WindowNotOpen();
    error WindowClosed();
    error WindowNotYetClosed();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error DisputeWindowOpen();
    error DisputeWindowClosed();
    error DurationTooLong();

    /// @notice Upper bound on `activationSLA` and `disputeWindow`, enforced
    /// at `contribute`. Mirrors `CapacityMarket.MAX_DURATION` — see that
    /// constant's NatSpec and docs/SECURITY_AUDIT_2026-10-01.md findings
    /// F2/F3 for why an unbounded duration here is exploitable.
    uint64 public constant MAX_DURATION = 365 days;

    /// @notice Upper bound on a terms class's arbitration panel size.
    /// Mirrors `CapacityMarket.MAX_PANEL_SIZE` — see that constant's NatSpec.
    uint256 public constant MAX_PANEL_SIZE = 9;

    modifier reservationInStatus(uint256 reservationId, ReservationStatus expected) {
        ReservationStatus actual = reservations[reservationId].status;
        if (actual != expected) revert WrongReservationStatus(expected, actual);
        _;
    }

    /// @notice Deterministic id for a terms class: any two contributions or
    /// reservations that hash to the same id are, by definition, fungible.
    function classId(TermsClass memory terms) public pure returns (bytes32) {
        return keccak256(abi.encode(terms));
    }

    /// @notice Provider contributes `quantity` fungible units to the class
    /// described by `terms`, posting `collateralPerUnit * quantity` as bond.
    /// The first contribution to a class fixes that class's terms; every
    /// later contribution to the same `classId` must match them exactly
    /// (guaranteed by construction, since `classId` is a hash of `terms`).
    function contribute(TermsClass calldata terms, uint256 quantity) external payable returns (bytes32 id) {
        if (terms.validUntil <= terms.validFrom) revert InvalidWindow();
        if (quantity == 0) revert WrongValue();
        if (terms.activationSLA > MAX_DURATION || terms.disputeWindow > MAX_DURATION) revert DurationTooLong();
        if (terms.panelMembers.length > MAX_PANEL_SIZE) revert InvalidPanel();
        if (terms.panelMembers.length == 0) {
            if (terms.panelThreshold != 0) revert InvalidPanel();
        } else if (terms.panelThreshold == 0 || terms.panelThreshold > terms.panelMembers.length) {
            revert InvalidPanel();
        }
        if (msg.value != terms.collateralPerUnit * quantity) revert WrongValue();

        id = classId(terms);
        PoolClass storage pool = pools[id];
        if (!pool.initialized) {
            pool.terms = terms;
            pool.initialized = true;
        }

        pool.contributions.push(Contribution({provider: msg.sender, remaining: quantity}));
        pool.totalCommitted += quantity;
        pool.available += quantity;

        emit Contributed(id, msg.sender, quantity, msg.value);
    }

    /// @notice Buyer reserves `quantity` fungible units from class `id`,
    /// paying `pricePerUnit * quantity`. Does not pick a provider; that
    /// happens at `activate()`.
    function reserve(bytes32 id, uint256 quantity) external payable returns (uint256 reservationId) {
        PoolClass storage pool = pools[id];
        if (!pool.initialized) revert WrongValue();
        if (quantity == 0) revert WrongValue();
        if (block.timestamp >= pool.terms.validUntil) revert WindowClosed();
        if (pool.available < quantity) revert InsufficientAvailableCapacity();
        if (msg.value != pool.terms.pricePerUnit * quantity) revert WrongValue();

        pool.available -= quantity;

        reservationId = nextReservationId++;
        Reservation storage r = reservations[reservationId];
        r.classId = id;
        r.buyer = msg.sender;
        r.quantity = quantity;
        r.status = ReservationStatus.Reserved;

        emit Reserved(reservationId, id, msg.sender, quantity);
    }

    /// @notice Current buyer transfers the reservation. Quantity and class
    /// terms are untouched — only the right to activate changes hands.
    function transferReservation(uint256 reservationId, address to)
        external
        reservationInStatus(reservationId, ReservationStatus.Reserved)
    {
        Reservation storage r = reservations[reservationId];
        if (msg.sender != r.buyer) revert NotBuyer();
        if (block.timestamp >= pools[r.classId].terms.validUntil) revert WindowClosed();

        r.buyer = to;
        emit ReservationTransferred(reservationId, msg.sender, to);
    }

    /// @notice Anyone may close out a reservation that was never activated
    /// before its window closed. The quantity returns to `available`, and
    /// the buyer's price is refunded in full.
    ///
    /// This refunds the buyer, unlike `CapacityMarket.expire()`'s
    /// provider-keeps-the-premium rule for a single-provider position — the
    /// two are deliberately asymmetric, not inconsistent. A `CapacityMarket`
    /// reservation names a specific provider from `reserve()` onward, so
    /// that provider bore the exclusivity cost of the whole window even if
    /// never activated, and the premium compensates them for it. A
    /// `CapacityPool` reservation names no provider until `activate()`
    /// assigns one; if it never activates, no specific provider was ever
    /// committed, so there is nobody with a non-arbitrary claim to the
    /// price, and pro-rating it across the whole class's contributors is
    /// not worth the complexity it would add to this level. Refunding the
    /// buyer is the only recipient the contract can name without guessing.
    /// See docs/TECHNICAL_README.md "Price on expiry".
    function expireReservation(uint256 reservationId)
        external
        reservationInStatus(reservationId, ReservationStatus.Reserved)
    {
        Reservation storage r = reservations[reservationId];
        PoolClass storage pool = pools[r.classId];
        if (block.timestamp < pool.terms.validUntil) revert WindowNotYetClosed();

        r.status = ReservationStatus.Expired;
        pool.available += r.quantity;

        emit ReservationExpired(reservationId);

        _payout(r.buyer, pool.terms.pricePerUnit * r.quantity);
    }

    /// @notice Provider reclaims the collateral behind contribution `index`'s
    /// unassigned (`remaining`) quantity, once the class's window has
    /// permanently closed. Without this, collateral behind capacity nobody
    /// ever reserved — or reserved but never activated, since
    /// `expireReservation` does not touch the contribution it would have
    /// drawn from — would stay locked in this contract forever.
    function withdrawContribution(bytes32 id, uint256 index) external {
        PoolClass storage pool = pools[id];
        if (!pool.initialized) revert WrongValue();
        if (block.timestamp < pool.terms.validUntil) revert WindowNotYetClosed();

        Contribution storage c = pool.contributions[index];
        if (msg.sender != c.provider) revert NotProvider();
        if (c.remaining == 0) revert WrongValue();

        uint256 amount = pool.terms.collateralPerUnit * c.remaining;
        c.remaining = 0;

        emit ContributionWithdrawn(id, index, msg.sender, amount);
        _payout(msg.sender, amount);
    }

    /// @notice Buyer activates the reservation. Walks the class's
    /// contribution queue FIFO, consuming whichever providers are oldest in
    /// line until `quantity` is covered, splitting across providers if
    /// needed. Each slice becomes an independent `Assignment` with the same
    /// shared activation deadline.
    function activate(uint256 reservationId) external reservationInStatus(reservationId, ReservationStatus.Reserved) {
        Reservation storage r = reservations[reservationId];
        if (msg.sender != r.buyer) revert NotBuyer();
        PoolClass storage pool = pools[r.classId];
        if (block.timestamp < pool.terms.validFrom || block.timestamp >= pool.terms.validUntil) {
            revert WindowNotOpen();
        }

        uint256 toAssign = r.quantity;
        uint256 head = pool.contribHead;

        while (toAssign > 0) {
            Contribution storage c = pool.contributions[head];
            if (c.remaining == 0) {
                head++;
                continue;
            }

            uint256 slice = c.remaining < toAssign ? c.remaining : toAssign;
            c.remaining -= slice;
            toAssign -= slice;

            r.assignments.push(
                Assignment({
                    provider: c.provider,
                    quantity: slice,
                    price: pool.terms.pricePerUnit * slice,
                    collateral: pool.terms.collateralPerUnit * slice,
                    deliveryEvidenceHash: bytes32(0),
                    disputeDeadline: 0,
                    status: AssignmentStatus.Pending
                })
            );

            if (c.remaining == 0) head++;
        }
        pool.contribHead = head;

        r.activationDeadline = uint64(block.timestamp) + pool.terms.activationSLA;
        r.status = ReservationStatus.Activated;

        emit ReservationActivated(reservationId, r.activationDeadline, r.assignments.length);
    }

    /// @notice Provider acknowledges their assigned slice within the SLA.
    function acceptAssignment(uint256 reservationId, uint256 assignmentIndex)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.Pending) revert WrongAssignmentStatus(AssignmentStatus.Pending, a.status);
        if (msg.sender != a.provider) revert NotProvider();
        if (block.timestamp > r.activationDeadline) revert DeadlinePassed();

        a.status = AssignmentStatus.Accepted;
        emit AssignmentAccepted(reservationId, assignmentIndex, msg.sender);
    }

    /// @notice Anyone may trigger default on one assignment once its shared
    /// deadline has passed without acceptance. Both `collateral` (the
    /// penalty) and `price` (refunded — no service was rendered for this
    /// slice) return to the buyer. Defaulting one slice has no effect on
    /// sibling assignments from other providers in the same reservation —
    /// a partial miss is a partial default, not a whole-reservation
    /// failure. Earlier drafts paid `collateral` only, leaving `price`
    /// permanently stuck — see docs/SECURITY_AUDIT_2026-10-01.md finding F1.
    function claimAssignmentDefault(uint256 reservationId, uint256 assignmentIndex)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.Pending) revert WrongAssignmentStatus(AssignmentStatus.Pending, a.status);
        if (block.timestamp <= r.activationDeadline) revert DeadlineNotPassed();

        a.status = AssignmentStatus.Defaulted;
        emit AssignmentDefaulted(reservationId, assignmentIndex, a.provider);

        _payout(r.buyer, a.price + a.collateral);
    }

    /// @notice Provider claims one accepted assignment's delivery is
    /// complete, committing to `evidenceHash` and starting the buyer's
    /// dispute window for that slice specifically — siblings are unaffected.
    function claimAssignmentDelivery(uint256 reservationId, uint256 assignmentIndex, bytes32 evidenceHash)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.Accepted) revert WrongAssignmentStatus(AssignmentStatus.Accepted, a.status);
        if (msg.sender != a.provider) revert NotProvider();

        a.deliveryEvidenceHash = evidenceHash;
        a.disputeDeadline = uint64(block.timestamp) + pools[r.classId].terms.disputeWindow;
        a.status = AssignmentStatus.DeliveryClaimed;

        emit AssignmentDeliveryClaimed(reservationId, assignmentIndex, evidenceHash, a.disputeDeadline);
    }

    /// @notice Buyer disputes one claimed assignment before its window
    /// closes, exactly as `CapacityMarket.dispute()` does for a whole
    /// position. `disputeDeadline` restarts as a second, equal-length
    /// window; if nothing resolves the dispute before it passes,
    /// `resolveAssignmentDisputeByTimeout` refunds the buyer — see that
    /// function's NatSpec and docs/TECHNICAL_README.md "Level 3: delivery
    /// claims and disputes".
    function disputeAssignment(uint256 reservationId, uint256 assignmentIndex, bytes32 reasonHash)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        if (msg.sender != r.buyer) revert NotBuyer();
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.DeliveryClaimed) {
            revert WrongAssignmentStatus(AssignmentStatus.DeliveryClaimed, a.status);
        }
        if (block.timestamp > a.disputeDeadline) revert DisputeWindowClosed();

        a.disputeDeadline = uint64(block.timestamp) + pools[r.classId].terms.disputeWindow;
        a.status = AssignmentStatus.Disputed;
        emit AssignmentDisputed(reservationId, assignmentIndex, reasonHash, a.disputeDeadline);
    }

    /// @notice Anyone may close out one assignment's unresolved dispute once
    /// its resolution window has passed, refunding the buyer for that
    /// slice's price and collateral. Mirrors
    /// `CapacityMarket.resolveDisputeByTimeout()` at the per-assignment
    /// grain — without it, `Disputed` would be a terminal state with no
    /// payout path.
    function resolveAssignmentDisputeByTimeout(uint256 reservationId, uint256 assignmentIndex)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.Disputed) revert WrongAssignmentStatus(AssignmentStatus.Disputed, a.status);
        if (block.timestamp <= a.disputeDeadline) revert DisputeWindowOpen();

        a.status = AssignmentStatus.Refunded;
        emit AssignmentRefunded(reservationId, assignmentIndex, r.buyer);

        _payout(r.buyer, a.price + a.collateral);
    }

    /// @notice A member of the class's arbitration panel casts one vote on
    /// one assignment's dispute. Mirrors `CapacityMarket.voteDispute`
    /// exactly — same no-deadline race against
    /// `resolveAssignmentDisputeByTimeout`, same unconditional revert if the
    /// class opted out (empty panel). Scoped to one assignment: votes and
    /// verdicts on one provider's disputed slice have no effect on a
    /// sibling assignment's dispute, even within the same reservation.
    function voteAssignmentDispute(uint256 reservationId, uint256 assignmentIndex, bool providerWins)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.Disputed) revert WrongAssignmentStatus(AssignmentStatus.Disputed, a.status);

        address[] storage members = pools[r.classId].terms.panelMembers;
        bool isMember = false;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        if (!isMember) revert NotArbitrator();
        if (disputeVotes[reservationId][assignmentIndex][msg.sender] != DisputeVote.None) revert AlreadyVoted();

        disputeVotes[reservationId][assignmentIndex][msg.sender] =
            providerWins ? DisputeVote.ProviderWins : DisputeVote.BuyerWins;
        uint256 pVotes =
            providerWins ? ++providerVoteCount[reservationId][assignmentIndex] : providerVoteCount[reservationId][assignmentIndex];
        uint256 bVotes =
            providerWins ? buyerVoteCount[reservationId][assignmentIndex] : ++buyerVoteCount[reservationId][assignmentIndex];

        emit AssignmentDisputeVoteCast(reservationId, assignmentIndex, msg.sender, providerWins, pVotes, bVotes);

        uint256 threshold = pools[r.classId].terms.panelThreshold;
        if (pVotes >= threshold) {
            _executeAssignmentDisputeVerdict(reservationId, assignmentIndex, true);
        } else if (bVotes >= threshold) {
            _executeAssignmentDisputeVerdict(reservationId, assignmentIndex, false);
        }
    }

    function _executeAssignmentDisputeVerdict(uint256 reservationId, uint256 assignmentIndex, bool providerWins)
        private
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        uint256 amount = a.price + a.collateral;
        if (providerWins) {
            a.status = AssignmentStatus.Settled;
            emit AssignmentDisputeResolved(reservationId, assignmentIndex, true);
            emit AssignmentSettled(reservationId, assignmentIndex, a.provider);
            _payout(a.provider, amount);
        } else {
            a.status = AssignmentStatus.Refunded;
            emit AssignmentDisputeResolved(reservationId, assignmentIndex, false);
            emit AssignmentRefunded(reservationId, assignmentIndex, r.buyer);
            _payout(r.buyer, amount);
        }
    }

    /// @notice Buyer confirms delivery of one claimed assignment, releasing
    /// that slice's price and collateral to its provider. Settlement is
    /// per-assignment so that one provider's unresolved slice never blocks
    /// payment to another.
    function settleAssignment(uint256 reservationId, uint256 assignmentIndex)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        if (msg.sender != r.buyer) revert NotBuyer();
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.DeliveryClaimed) {
            revert WrongAssignmentStatus(AssignmentStatus.DeliveryClaimed, a.status);
        }

        a.status = AssignmentStatus.Settled;
        emit AssignmentSettled(reservationId, assignmentIndex, a.provider);

        _payout(a.provider, a.price + a.collateral);
    }

    /// @notice Anyone may pay a provider once their assignment's dispute
    /// window passed without the buyer disputing or settling — mirrors
    /// `CapacityMarket.finalizeDelivery()`'s protection against a silent
    /// buyer, at the per-assignment grain.
    function finalizeAssignmentDelivery(uint256 reservationId, uint256 assignmentIndex)
        external
        reservationInStatus(reservationId, ReservationStatus.Activated)
    {
        Reservation storage r = reservations[reservationId];
        Assignment storage a = r.assignments[assignmentIndex];
        if (a.status != AssignmentStatus.DeliveryClaimed) {
            revert WrongAssignmentStatus(AssignmentStatus.DeliveryClaimed, a.status);
        }
        if (block.timestamp <= a.disputeDeadline) revert DisputeWindowOpen();

        a.status = AssignmentStatus.Settled;
        emit AssignmentSettled(reservationId, assignmentIndex, a.provider);

        _payout(a.provider, a.price + a.collateral);
    }

    // --- Views ---------------------------------------------------------

    function poolInfo(bytes32 id)
        external
        view
        returns (TermsClass memory terms, uint256 totalCommitted, uint256 available, uint256 contributionsCount)
    {
        PoolClass storage pool = pools[id];
        return (pool.terms, pool.totalCommitted, pool.available, pool.contributions.length);
    }

    function contributionInfo(bytes32 id, uint256 index) external view returns (address provider, uint256 remaining) {
        Contribution storage c = pools[id].contributions[index];
        return (c.provider, c.remaining);
    }

    function reservationInfo(uint256 reservationId)
        external
        view
        returns (
            bytes32 classId_,
            address buyer,
            uint256 quantity,
            uint64 activationDeadline,
            ReservationStatus status,
            uint256 assignmentCount
        )
    {
        Reservation storage r = reservations[reservationId];
        return (r.classId, r.buyer, r.quantity, r.activationDeadline, r.status, r.assignments.length);
    }

    function assignmentInfo(uint256 reservationId, uint256 index)
        external
        view
        returns (
            address provider,
            uint256 quantity,
            uint256 price,
            uint256 collateral,
            bytes32 deliveryEvidenceHash,
            uint64 disputeDeadline,
            AssignmentStatus status
        )
    {
        Assignment storage a = reservations[reservationId].assignments[index];
        return (a.provider, a.quantity, a.price, a.collateral, a.deliveryEvidenceHash, a.disputeDeadline, a.status);
    }

    // `to` is always `r.buyer` or `a.provider` read from storage at the call
    // site, never an address passed directly by the caller of the public
    // function — so this is not an arbitrary-send-eth sink despite the lint.
    function _payout(address to, uint256 amount) private {
        if (amount == 0) return;
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        require(ok, "payout failed");
    }
}
