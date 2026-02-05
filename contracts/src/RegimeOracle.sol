// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RegimeOracle
 * @notice Market hours and holiday calendar oracle
 */
contract RegimeOracle {
    // ============ Enums ============

    enum Regime {
        CORE_SESSION, // 9:35-16:00 ET
        SOFT_OPEN, // 9:30-9:35 ET
        PRE_MARKET, // 4:00-9:30 ET
        AFTER_HOURS, // 16:00-20:00 ET
        OVERNIGHT, // 20:00-4:00 ET
        WEEKEND, // Fri 20:00 - Mon 4:00 ET
        HOLIDAY
    }

    // ============ Constants ============

    int256 private constant ET_OFFSET = -5 hours; // EST offset from UTC
    int256 private constant EDT_OFFSET = -4 hours; // EDT offset from UTC

    uint256 private constant CORE_START_HOUR = 9;
    uint256 private constant CORE_START_MINUTE = 35;
    uint256 private constant CORE_END_HOUR = 16;

    uint256 private constant SOFT_OPEN_START = 9 * 60 + 30; // 9:30 in minutes
    uint256 private constant SOFT_OPEN_END = 9 * 60 + 35; // 9:35 in minutes

    uint256 private constant PRE_MARKET_START = 4 * 60; // 4:00 in minutes
    uint256 private constant AFTER_HOURS_END = 20 * 60; // 20:00 in minutes

    // ============ State Variables ============

    mapping(uint256 => bool) public holidays; // date (yyyyMMdd) => isHoliday
    address public governance;

    // DST transition dates (can be updated by governance)
    uint256 public dstStartMonth = 3; // March
    uint256 public dstStartWeek = 2; // Second Sunday
    uint256 public dstEndMonth = 11; // November
    uint256 public dstEndWeek = 1; // First Sunday

    // ============ Events ============

    event HolidayAdded(uint256 indexed date);
    event HolidayRemoved(uint256 indexed date);
    event RegimeQueried(uint256 timestamp, Regime regime);

    // ============ Errors ============

    error UnauthorizedCaller();

    // ============ Modifiers ============

    modifier onlyGovernance() {
        if (msg.sender != governance) revert UnauthorizedCaller();
        _;
    }

    // ============ Constructor ============

    constructor(address _governance) {
        governance = _governance;
        _initializeHolidays();
    }

    // ============ External Functions ============

    /**
     * @notice Get current market regime
     */
    function getCurrentRegime() external view returns (Regime) {
        return getRegimeAtTime(block.timestamp);
    }

    /**
     * @notice Get regime for any timestamp
     */
    function getRegimeAtTime(uint256 timestamp) public view returns (Regime) {
        // Convert to Eastern Time
        (uint256 etHour, uint256 etMinute, uint256 dayOfWeek) = _toEasternTime(
            timestamp
        );

        // Check if holiday
        if (isHoliday(timestamp)) {
            return Regime.HOLIDAY;
        }

        // Check if weekend (Saturday=6, Sunday=0)
        if (dayOfWeek == 6 || dayOfWeek == 0) {
            return Regime.WEEKEND;
        }

        // Check Friday evening to Monday morning
        if (dayOfWeek == 5 && etHour >= 20) {
            return Regime.WEEKEND;
        }
        if (dayOfWeek == 1 && etHour < 4) {
            return Regime.WEEKEND;
        }

        // Convert to minutes for easier comparison
        uint256 minuteOfDay = etHour * 60 + etMinute;

        // Determine regime based on time
        if (minuteOfDay < PRE_MARKET_START) {
            return Regime.OVERNIGHT;
        } else if (minuteOfDay < SOFT_OPEN_START) {
            return Regime.PRE_MARKET;
        } else if (minuteOfDay < SOFT_OPEN_END) {
            return Regime.SOFT_OPEN;
        } else if (minuteOfDay < CORE_END_HOUR * 60) {
            return Regime.CORE_SESSION;
        } else if (minuteOfDay < AFTER_HOURS_END) {
            return Regime.AFTER_HOURS;
        } else {
            return Regime.OVERNIGHT;
        }
    }

    /**
     * @notice Check if date is a market holiday
     */
    function isHoliday(uint256 timestamp) public view returns (bool) {
        uint256 dateKey = _getDateKey(timestamp);
        return holidays[dateKey];
    }

    /**
     * @notice Get time until next regime transition
     */
    function getNextTransition()
        external
        view
        returns (uint256 timeUntil, Regime nextRegime)
    {
        uint256 current = block.timestamp;
        Regime currentRegime = getRegimeAtTime(current);

        // Search for next transition (simplified)
        for (uint256 i = 1; i <= 24 * 3600; i += 300) {
            // Check every 5 minutes
            uint256 futureTime = current + i;
            Regime futureRegime = getRegimeAtTime(futureTime);

            if (futureRegime != currentRegime) {
                return (i, futureRegime);
            }
        }

        return (24 hours, currentRegime);
    }

    /**
     * @notice Add a market holiday
     */
    function addHoliday(
        uint256 year,
        uint256 month,
        uint256 day
    ) external onlyGovernance {
        uint256 dateKey = year * 10000 + month * 100 + day;
        holidays[dateKey] = true;
        emit HolidayAdded(dateKey);
    }

    /**
     * @notice Remove a market holiday
     */
    function removeHoliday(
        uint256 year,
        uint256 month,
        uint256 day
    ) external onlyGovernance {
        uint256 dateKey = year * 10000 + month * 100 + day;
        holidays[dateKey] = false;
        emit HolidayRemoved(dateKey);
    }

    /**
     * @notice Batch add holidays
     */
    function addHolidays(uint256[] calldata dates) external onlyGovernance {
        for (uint256 i = 0; i < dates.length; i++) {
            holidays[dates[i]] = true;
            emit HolidayAdded(dates[i]);
        }
    }

    // ============ Internal Functions ============

    function _toEasternTime(
        uint256 timestamp
    ) internal view returns (uint256 hour, uint256 minute, uint256 dayOfWeek) {
        // Determine if DST is active
        bool isDST = _isDaylightSavingTime(timestamp);
        int256 offset = isDST ? EDT_OFFSET : ET_OFFSET;

        // Apply offset
        uint256 etTimestamp = uint256(int256(timestamp) + offset);

        // Calculate time components
        uint256 secondsInDay = etTimestamp % 86400;
        hour = secondsInDay / 3600;
        minute = (secondsInDay % 3600) / 60;

        // Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
        dayOfWeek = ((etTimestamp / 86400) + 4) % 7; // Unix epoch was Thursday

        return (hour, minute, dayOfWeek);
    }

    function _isDaylightSavingTime(
        uint256 timestamp
    ) internal view returns (bool) {
        (uint256 year, uint256 month, uint256 day) = _timestampToDate(
            timestamp
        );

        // Before DST start month
        if (month < dstStartMonth) return false;

        // After DST end month
        if (month > dstEndMonth) return false;

        // In DST start month - check if after second Sunday
        if (month == dstStartMonth) {
            uint256 secondSunday = _getNthSundayOfMonth(
                year,
                month,
                dstStartWeek
            );
            return day >= secondSunday;
        }

        // In DST end month - check if before first Sunday
        if (month == dstEndMonth) {
            uint256 firstSunday = _getNthSundayOfMonth(year, month, dstEndWeek);
            return day < firstSunday;
        }

        // Between start and end months
        return true;
    }

    function _timestampToDate(
        uint256 timestamp
    ) internal pure returns (uint256 year, uint256 month, uint256 day) {
        // Simplified date conversion
        uint256 daysSinceEpoch = timestamp / 86400;
        uint256 yearsSinceEpoch = daysSinceEpoch / 365; // Approximation
        year = 1970 + yearsSinceEpoch;

        // More accurate calculation would be needed for production
        month = 1;
        day = 1;

        return (year, month, day);
    }

    function _getNthSundayOfMonth(
        uint256 year,
        uint256 month,
        uint256 n
    ) internal pure returns (uint256) {
        // Simplified - would need actual calendar calculation
        return n * 7;
    }

    function _getDateKey(uint256 timestamp) internal pure returns (uint256) {
        (uint256 year, uint256 month, uint256 day) = _timestampToDate(
            timestamp
        );
        return year * 10000 + month * 100 + day;
    }

    function _initializeHolidays() internal {
        // 2026 NYSE Holidays
        holidays[20260101] = true; // New Year's Day
        holidays[20260119] = true; // MLK Day
        holidays[20260216] = true; // Presidents' Day
        holidays[20260403] = true; // Good Friday
        holidays[20260525] = true; // Memorial Day
        holidays[20260703] = true; // Independence Day (observed)
        holidays[20260907] = true; // Labor Day
        holidays[20261126] = true; // Thanksgiving
        holidays[20261225] = true; // Christmas
    }

    // ============ View Functions ============

    function getRegimeString(
        Regime regime
    ) external pure returns (string memory) {
        if (regime == Regime.CORE_SESSION) return "CORE_SESSION";
        if (regime == Regime.SOFT_OPEN) return "SOFT_OPEN";
        if (regime == Regime.PRE_MARKET) return "PRE_MARKET";
        if (regime == Regime.AFTER_HOURS) return "AFTER_HOURS";
        if (regime == Regime.OVERNIGHT) return "OVERNIGHT";
        if (regime == Regime.WEEKEND) return "WEEKEND";
        return "HOLIDAY";
    }
}
