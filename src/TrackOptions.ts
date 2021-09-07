import { Conflux } from 'js-conflux-sdk';

export interface TrackOptions {
    conflux?: Conflux,
    web3?: any,
    address: string,
    startFrom?: number,
    topics: (string|string[])[],
    terminateOnSyncComplete?: boolean,
    catchUpSleepPeriodSec?: number,
    maxEpochGap?: number,
    maxBlockGap?: number,
    epochCommitPeriod?: number,
    blockCommitPeriod?: number,
    label?: string,
    log?: (string) => void,
}