
import assert from 'assert';

import { ConfluxLog } from './ConfluxLog';
import { TrackOptions } from '.';

const snooze = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms, undefined));

export async function *trackEvents(opts: TrackOptions): AsyncIterable<{ epoch: number; logs: ConfluxLog[] }> {
    const { conflux } = opts;

    let nextToQuery: number = opts.startFrom;
    let nextToReturn: number = opts.startFrom;
    let buffer: { [key: number]: ConfluxLog[] } = {};

    while (true) {
        // try to return from local buffer
        while (nextToReturn < nextToQuery) {
            const epoch = nextToReturn;
            nextToReturn += 1;

            if (buffer[epoch]) {
                const logs = buffer[epoch];

                assert(logs.length > 0);
                assert(epoch == logs[0].epochNumber);

                delete buffer[epoch];
                yield { epoch, logs };
            } else {
                yield { epoch, logs: [] };
            }
        }

        // request more
        const best = await conflux.getEpochNumber('latest_confirmed');
        const fromEpoch = nextToQuery;

        // check if caught up
        if (fromEpoch >= best - 10) {
            if (opts.terminateOnSyncComplete) {
                opts.log && opts.log(`(${opts.label}) sync complete (latest epoch = ${nextToQuery - 1})`);
                return;
            }

            await snooze(opts.catchUpSleepPeriodSec * 1000);
            continue;
        }

        const toEpoch = Math.min(
            fromEpoch + opts.maxEpochGap - 1,
            best
        );

        const progressPercentage = Math.round(10000 * (toEpoch / best)) / 100;
        opts.log && opts.log(`(${opts.label}) requesting logs for epochs ${fromEpoch}..${toEpoch} (${progressPercentage}%)`);

        const logs = <ConfluxLog[]>await conflux.getLogs({
            address: opts.address,
            topics: opts.topics,
            fromEpoch,
            toEpoch,
        });

        buffer = {};

        for (const log of logs) {
            buffer[log.epochNumber] = buffer[log.epochNumber] || [];
            buffer[log.epochNumber].push(log);
        }

        nextToQuery = toEpoch + 1;
    }
}
