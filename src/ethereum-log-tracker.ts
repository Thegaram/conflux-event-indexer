import { Transaction } from 'sequelize/types';
import { Sequelize } from 'sequelize-typescript';

import { EthereumLog } from './EthereumLog';
import { LogSyncStatus } from './models';
import { trackEvents } from './track-eth-events';
import { TrackOptions } from './TrackOptions';

export class EthereumLogTracker {
    private db: Sequelize;

    static async init(db: Sequelize): Promise<EthereumLogTracker> {
        db.addModels([LogSyncStatus]);
        await LogSyncStatus.sync();

        const tracker = new EthereumLogTracker();
        tracker.db = db;
        return tracker;
    }

    async *track(opts: TrackOptions): AsyncIterable<[EthereumLog, Transaction]> {
        const address = opts.address;

        opts.startFrom = opts.hasOwnProperty('startFrom') ? opts.startFrom : 0;
        opts.terminateOnSyncComplete = opts.hasOwnProperty('terminateOnSyncComplete') ? opts.terminateOnSyncComplete : true;
        opts.catchUpSleepPeriodSec = opts.hasOwnProperty('catchUpSleepPeriodSec') ? opts.catchUpSleepPeriodSec : 3;
        opts.maxBlockGap = opts.hasOwnProperty('maxBlockGap') ? opts.maxBlockGap : 1000;
        opts.blockCommitPeriod = opts.hasOwnProperty('blockCommitPeriod') ? opts.blockCommitPeriod : 10000;
        opts.label = opts.hasOwnProperty('label') ? opts.label : '';

        // initialize sync status in database
        const [status] = await LogSyncStatus.findOrCreate({
            where: { address },
            defaults: {
                address,
                earliest: opts.startFrom,
                latest: opts.startFrom - 1,
            },
        });

        const tracker = trackEvents(
            { ...opts, startFrom: status.latest + 1 },
        );

        let lastBlock = 0;

        for await (const { block, logs } of tracker) {
            // if there are logs, process them
            if (logs.length > 0) {
                opts.log && opts.log(`Found ${logs.length} logs in block ${block}`);

                const t = await this.db.transaction();

                try {
                    // yield to caller
                    for (const log of logs) {
                        yield [log, t];
                    }

                    // persist latest processed block
                    status.latest = block;
                    await status.save();

                    await t.commit();
                } catch (error) {
                    console.error(error);
                    await t.rollback();
                    return;
                }
            }

            // if there are no logs in this block,
            // we still commit our progress periodically
            else if (block % opts.blockCommitPeriod === 0) {
                status.latest = block;
                await status.save();
            }

            lastBlock = block;
        }

        if (lastBlock > 0) {
            status.latest = lastBlock;
            await status.save();
        }
    }
}