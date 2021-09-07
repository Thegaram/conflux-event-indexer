
import assert from 'assert';

import { EthereumLog } from './EthereumLog';
import { TrackOptions } from '.';

const snooze = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms, undefined));

export async function *trackEvents(opts: TrackOptions): AsyncIterable<{ block: number; logs: EthereumLog[] }> {
    const { web3 } = opts;

    let nextToQuery: number = opts.startFrom;
    let nextToReturn: number = opts.startFrom;
    let buffer: { [key: number]: EthereumLog[] } = {};

    while (true) {

        // try to return from local buffer
        while (nextToReturn < nextToQuery) {
            const block = nextToReturn;
            nextToReturn += 1;

            if (buffer[block]) {
                const logs = buffer[block];

                assert(logs.length > 0);
                // @ts-ignore
                assert(block == logs[0].blockNumber);

                delete buffer[block];
                yield { block, logs };
            } else {
                yield { block, logs: [] };
            }
        }

        // request more
        let best = await web3.eth.getBlockNumber();
        best = best < 5 ? 0 : best - 5;

        const fromBlock = nextToQuery;

        // check if caught up
        if (fromBlock >= best - 10) {
            if (opts.terminateOnSyncComplete) {
                opts.log && opts.log(`(${opts.label}) sync complete (latest block = ${nextToQuery - 1})`);
                return;
            }

            await snooze(opts.catchUpSleepPeriodSec * 1000);
            continue;
        }

        const toBlock = Math.min(
            fromBlock + opts.maxBlockGap - 1,
            best
        );

        const progressPercentage = Math.round(10000 * (toBlock / best)) / 100;
        opts.log && opts.log(`(${opts.label}) requesting logs for blocks ${fromBlock}..${toBlock} (${progressPercentage}%)`);

        const logs = await web3.eth.getPastLogs({
            fromBlock,
            toBlock,
            address: opts.address,
            topics: opts.topics,
        });

        buffer = {};

        for (const log of logs) {
            buffer[log.blockNumber] = buffer[log.blockNumber] || [];
            buffer[log.blockNumber].push(log);
        }

        nextToQuery = toBlock + 1;
    }
}
