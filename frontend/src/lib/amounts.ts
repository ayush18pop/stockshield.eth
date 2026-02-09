import { formatUnits, parseUnits } from 'viem';

type FormatOptions = {
    maxFractionDigits?: number;
    minFractionDigits?: number;
};

function addThousandsSeparators(value: string): string {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseTokenAmount(value: string, decimals: number): bigint {
    if (!value || Number(value) <= 0) return BigInt(0);
    try {
        return parseUnits(value, decimals);
    } catch {
        return BigInt(0);
    }
}

export function formatTokenAmount(
    value: bigint | undefined,
    decimals: number,
    options: FormatOptions = {}
): string {
    const maxFractionDigits = options.maxFractionDigits ?? Math.min(6, decimals);
    const minFractionDigits = options.minFractionDigits ?? 0;

    if (value === undefined) {
        if (minFractionDigits > 0) return `0.${'0'.repeat(minFractionDigits)}`;
        return '0';
    }

    const formatted = formatUnits(value, decimals);
    const [integerPartRaw = '0', fractionPartRaw = ''] = formatted.split('.');

    const integerPart = addThousandsSeparators(integerPartRaw);
    if (maxFractionDigits === 0) return integerPart;

    const clipped = fractionPartRaw.slice(0, maxFractionDigits);
    const trimmed = clipped.replace(/0+$/, '');
    const finalFraction =
        trimmed.length >= minFractionDigits
            ? trimmed
            : trimmed.padEnd(minFractionDigits, '0');

    if (!finalFraction) return integerPart;
    return `${integerPart}.${finalFraction}`;
}

export function formatDecimalNumber(value: number, maxFractionDigits: number = 6): string {
    if (!Number.isFinite(value)) return '0';
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    }).format(value);
}
