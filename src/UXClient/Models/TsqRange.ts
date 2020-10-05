import Utils from '../Utils';

class TsqRange{
    public from: Date;
    public to: Date;
    private bucketSizeMs: number;

    // List of interval values that would divide a time range neatly
    static NeatIntervals = [
        '1ms', '2ms', '4ms', '5ms', '8ms', '10ms', '20ms', '25ms', '40ms', '50ms', '100ms', '125ms', '200ms', '250ms', '500ms',
        '1s', '2s', '3s', '4s', '5s', '6s', '10s', '12s', '15s', '20s', '30s',
        '1m', '2m', '3m', '4m', '5m', '6m', '10m', '12m', '15m', '20m', '30m',
        '1h', '2h', '3h', '4h', '6h', '8h', '12h',
        '1d', '2d', '3d', '4d', '5d', '6d', '7d' 
    ];

    static NeatIntervalsMs = [
        1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 125, 200, 250, 500,
        1000, 2000, 3000, 4000, 5000, 6000, 10000, 12000, 15000, 20000, 30000,
        60000, 120000, 180000, 240000, 300000, 360000, 600000, 720000, 900000, 1200000, 1800000,
        3600000, 7200000, 10800000, 14400000, 21600000, 28800000, 43200000,
        86400000, 172800000, 259200000, 345600000, 432000000, 518400000, 604800000
    ];

    constructor(from: Date, to: Date) {
        this.from = from;
        this.to = to;
    }

    setNeatBucketSizeByNumerOfBuckets(targetNumberOfBuckets: number) {
        let timeRangeMs = Math.max(this.to.valueOf() - this.from.valueOf(), 1);
        let roughBucketsize = Math.ceil(timeRangeMs / targetNumberOfBuckets);
        this.setNeatBucketSizeByRoughBucketSize(roughBucketsize);
    }

    setNeatBucketSizeByRoughBucketSize(roughBucketSizeMillis: number) {
        let neatIntervalIndex = 1;
        for (; neatIntervalIndex < TsqRange.NeatIntervalsMs.length; neatIntervalIndex++) {
            if (TsqRange.NeatIntervalsMs[neatIntervalIndex] > roughBucketSizeMillis) { break; }
        }

        this.bucketSizeMs = TsqRange.NeatIntervalsMs[neatIntervalIndex - 1];
    }

    alignWithServerEpoch() {
        let fromMs = Utils.adjustStartMillisToAbsoluteZero(this.from.valueOf(), this.bucketSizeMs);
        let toMs = Utils.roundToMillis(this.to.valueOf(), this.bucketSizeMs);
        this.from = new Date(fromMs);
        this.to = new Date(toMs);
    }

    get fromMillis() {
        return this.from.valueOf();
    }

    get toMillis() {
        return this.to.valueOf();
    }

    get bucketSizeMillis() {
        return this.bucketSizeMs;
    }

    get bucketSizeStr() {
        let bucketSize = TsqRange.millisToLargestUnit(this.bucketSizeMs);
        return `${bucketSize.value}${bucketSize.unit}`;
    }

    static millisToLargestUnit(interval: number) {
        let value: number, unit: string;

        if (interval < 1000) { 
            value = interval;
            unit = 'ms';
        } else if (interval < 1000 * 60) {
            value =  Math.ceil(interval / 1000);
            unit = 's';
        } else if (interval < 1000 * 60 * 60) {
            value = Math.ceil(interval / (1000 * 60));
            unit = 'm';
        } else if (interval < 1000 * 60 * 60 * 24) {
            value = Math.ceil(interval / (1000 * 60 * 60));
            unit = 'h';
        } else {
            value = Math.ceil(interval / (1000 * 60 * 60 * 24));
            unit = 'd';
        }

        return { value, unit };
    }
}

export { TsqRange };