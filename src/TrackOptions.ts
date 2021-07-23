import { Conflux } from 'js-conflux-sdk';

export interface TrackOptions {
    conflux: Conflux,
    address: string,
    startFrom?: number,
    topics: (string|string[])[],
    terminateOnSyncComplete?: boolean,
    catchUpSleepPeriodSec?: number,
    maxEpochGap?: number,
    epochCommitPeriod?: number,
    label?: string,
    log?: (string) => void,
}