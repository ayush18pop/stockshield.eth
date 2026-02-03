/**
 * Market Regime Detector
 * 
 * Detects the current market regime based on NYSE trading hours.
 * Handles Eastern Time conversion, DST, and holiday calendar.
 */

export enum Regime {
    CORE_SESSION = 'CORE_SESSION',   // 9:35 AM - 4:00 PM ET
    SOFT_OPEN = 'SOFT_OPEN',         // 9:30 AM - 9:35 AM ET (gap auction period)
    PRE_MARKET = 'PRE_MARKET',       // 4:00 AM - 9:30 AM ET
    AFTER_HOURS = 'AFTER_HOURS',     // 4:00 PM - 8:00 PM ET
    OVERNIGHT = 'OVERNIGHT',         // 8:00 PM - 4:00 AM ET
    WEEKEND = 'WEEKEND',             // Fri 8:00 PM - Mon 4:00 AM ET
    HOLIDAY = 'HOLIDAY',             // Market holidays
}

export interface RegimeConfig {
    coreStart: { hour: number; minute: number };      // 9:35 AM
    coreEnd: { hour: number; minute: number };        // 4:00 PM
    softOpenStart: { hour: number; minute: number };  // 9:30 AM
    preMarketStart: { hour: number; minute: number }; // 4:00 AM
    afterHoursEnd: { hour: number; minute: number };  // 8:00 PM
    holidays: string[]; // ISO date strings (YYYY-MM-DD)
}

export interface RegimeInfo {
    regime: Regime;
    multiplier: number;     // Fee multiplier for this regime
    baseFee: number;        // Base fee in bps
    maxFee: number;         // Max fee in bps
    riskLevel: 'low' | 'medium' | 'high' | 'very-high' | 'extreme';
}

const DEFAULT_CONFIG: RegimeConfig = {
    coreStart: { hour: 9, minute: 35 },
    coreEnd: { hour: 16, minute: 0 },
    softOpenStart: { hour: 9, minute: 30 },
    preMarketStart: { hour: 4, minute: 0 },
    afterHoursEnd: { hour: 20, minute: 0 },
    holidays: [
        // 2026 NYSE Holidays
        '2026-01-01', // New Year's Day
        '2026-01-19', // MLK Day
        '2026-02-16', // Presidents' Day
        '2026-04-03', // Good Friday
        '2026-05-25', // Memorial Day
        '2026-07-03', // Independence Day (observed)
        '2026-09-07', // Labor Day
        '2026-11-26', // Thanksgiving
        '2026-12-25', // Christmas
    ],
};

const REGIME_PARAMETERS: Record<Regime, Omit<RegimeInfo, 'regime'>> = {
    [Regime.CORE_SESSION]: {
        multiplier: 1.0,
        baseFee: 5,
        maxFee: 50,
        riskLevel: 'low',
    },
    [Regime.SOFT_OPEN]: {
        multiplier: 1.5,
        baseFee: 10,
        maxFee: 75,
        riskLevel: 'medium',
    },
    [Regime.PRE_MARKET]: {
        multiplier: 2.0,
        baseFee: 15,
        maxFee: 100,
        riskLevel: 'medium',
    },
    [Regime.AFTER_HOURS]: {
        multiplier: 2.0,
        baseFee: 15,
        maxFee: 100,
        riskLevel: 'medium',
    },
    [Regime.OVERNIGHT]: {
        multiplier: 4.0,
        baseFee: 30,
        maxFee: 300,
        riskLevel: 'high',
    },
    [Regime.WEEKEND]: {
        multiplier: 6.0,
        baseFee: 50,
        maxFee: 500,
        riskLevel: 'very-high',
    },
    [Regime.HOLIDAY]: {
        multiplier: 6.0,
        baseFee: 50,
        maxFee: 500,
        riskLevel: 'extreme',
    },
};

export class RegimeDetector {
    private config: RegimeConfig;

    constructor(config: Partial<RegimeConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get current regime
     */
    getCurrentRegime(timestamp?: number): RegimeInfo {
        const regime = this.detectRegime(timestamp);
        return {
            regime,
            ...REGIME_PARAMETERS[regime],
        };
    }

    /**
     * Detect regime for a given timestamp
     */
    detectRegime(timestamp?: number): Regime {
        const now = timestamp ? new Date(timestamp) : new Date();
        const etDate = this.toEasternTime(now);

        // Check if holiday
        if (this.isHoliday(etDate)) {
            return Regime.HOLIDAY;
        }

        const dayOfWeek = etDate.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = etDate.getHours();
        const minute = etDate.getMinutes();

        // Weekend check
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return Regime.WEEKEND;
        }
        if (dayOfWeek === 5 && (hour >= this.config.afterHoursEnd.hour)) {
            return Regime.WEEKEND; // Friday after 8 PM
        }
        if (dayOfWeek === 1 && (hour < this.config.preMarketStart.hour)) {
            return Regime.WEEKEND; // Monday before 4 AM
        }

        // Weekday regimes
        const timeInMinutes = hour * 60 + minute;
        const coreStartMin = this.config.coreStart.hour * 60 + this.config.coreStart.minute;
        const coreEndMin = this.config.coreEnd.hour * 60 + this.config.coreEnd.minute;
        const softOpenStartMin = this.config.softOpenStart.hour * 60 + this.config.softOpenStart.minute;
        const preMarketStartMin = this.config.preMarketStart.hour * 60 + this.config.preMarketStart.minute;
        const afterHoursEndMin = this.config.afterHoursEnd.hour * 60 + this.config.afterHoursEnd.minute;

        // Core session: 9:35 AM - 4:00 PM
        if (timeInMinutes >= coreStartMin && timeInMinutes < coreEndMin) {
            return Regime.CORE_SESSION;
        }

        // Soft open: 9:30 AM - 9:35 AM
        if (timeInMinutes >= softOpenStartMin && timeInMinutes < coreStartMin) {
            return Regime.SOFT_OPEN;
        }

        // Pre-market: 4:00 AM - 9:30 AM
        if (timeInMinutes >= preMarketStartMin && timeInMinutes < softOpenStartMin) {
            return Regime.PRE_MARKET;
        }

        // After-hours: 4:00 PM - 8:00 PM
        if (timeInMinutes >= coreEndMin && timeInMinutes < afterHoursEndMin) {
            return Regime.AFTER_HOURS;
        }

        // Overnight: 8:00 PM - 4:00 AM
        return Regime.OVERNIGHT;
    }

    /**
     * Check if a date is a market holiday
     */
    isHoliday(date: Date): boolean {
        const dateStr = date.toISOString().split('T')[0] || '';
        return this.config.holidays.includes(dateStr);
    }

    /**
     * Convert UTC to Eastern Time (handles DST)
     */
    toEasternTime(utcDate: Date): Date {
        // Use Intl API for accurate timezone conversion
        const etString = utcDate.toLocaleString('en-US', {
            timeZone: 'America/New_York',
        });
        return new Date(etString);
    }

    /**
     * Get time until next regime change
     */
    getTimeUntilNextRegime(timestamp?: number): {
        nextRegime: Regime;
        secondsUntil: number;
    } {
        const now = timestamp || Date.now();
        const currentRegime = this.detectRegime(now);

        // Check next few minutes to find regime change
        for (let seconds = 60; seconds <= 86400; seconds += 60) {
            const futureTimestamp = now + seconds * 1000;
            const futureRegime = this.detectRegime(futureTimestamp);

            if (futureRegime !== currentRegime) {
                return {
                    nextRegime: futureRegime,
                    secondsUntil: seconds,
                };
            }
        }

        // Fallback (shouldn't happen)
        return {
            nextRegime: currentRegime,
            secondsUntil: 0,
        };
    }

    /**
     * Add a holiday to the calendar
     */
    addHoliday(date: string): void {
        if (!this.config.holidays.includes(date)) {
            this.config.holidays.push(date);
            this.config.holidays.sort();
        }
    }
}

// ============================================================================
// Self-Test (run with: npx ts-node src/yellow/regime-detector.ts)
// ============================================================================

if (require.main === module) {
    console.log('🧪 Regime Detector Self-Test\n');

    const detector = new RegimeDetector();

    // Test various times
    const testCases = [
        { time: '2026-02-03T14:00:00Z', desc: 'Monday 9:00 AM ET (Pre-Market)', expected: Regime.PRE_MARKET },
        { time: '2026-02-03T14:32:00Z', desc: 'Monday 9:32 AM ET (Soft Open)', expected: Regime.SOFT_OPEN },
        { time: '2026-02-03T15:00:00Z', desc: 'Monday 10:00 AM ET (Core)', expected: Regime.CORE_SESSION },
        { time: '2026-02-03T21:00:00Z', desc: 'Monday 4:00 PM ET (After Hours)', expected: Regime.AFTER_HOURS },
        { time: '2026-02-04T02:00:00Z', desc: 'Monday 9:00 PM ET (Overnight)', expected: Regime.OVERNIGHT },
        { time: '2026-02-07T15:00:00Z', desc: 'Saturday 10:00 AM ET (Weekend)', expected: Regime.WEEKEND },
        { time: '2026-01-01T15:00:00Z', desc: 'New Year\'s Day (Holiday)', expected: Regime.HOLIDAY },
    ];

    console.log('Testing regime detection:');
    console.log('─'.repeat(80));

    for (const test of testCases) {
        const timestamp = new Date(test.time).getTime();
        const info = detector.getCurrentRegime(timestamp);
        const match = info.regime === test.expected ? '✓' : '✗';
        console.log(`${match} ${test.desc}`);
        console.log(`   Detected: ${info.regime} (${info.riskLevel} risk, ${info.multiplier}x multiplier)`);
        if (info.regime !== test.expected) {
            console.log(`   Expected: ${test.expected}`);
        }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('Testing time until next regime:');
    const now = new Date('2026-02-03T14:28:00Z').getTime(); // 9:28 AM ET
    const next = detector.getTimeUntilNextRegime(now);
    console.log(`Current: ${detector.detectRegime(now)}`);
    console.log(`Next: ${next.nextRegime} in ${next.secondsUntil / 60} minutes`);

    console.log('\n✅ All tests completed!');
}
