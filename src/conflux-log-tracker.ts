import { Transaction } from 'sequelize/types';
import { Sequelize } from 'sequelize-typescript';

import { ConfluxLog } from './ConfluxLog';
import { LogSyncStatus } from './models';
import { trackEvents } from './track-events';
import { TrackOptions } from './TrackOptions';

export class ConfluxLogTracker {
    private db: Sequelize;

    static async init(db: Sequelize): Promise<ConfluxLogTracker> {
        db.addModels([LogSyncStatus]);
        await LogSyncStatus.sync();

        const tracker = new ConfluxLogTracker();
        tracker.db = db;
        return tracker;
    }

    async *track(opts: TrackOptions): AsyncIterable<[ConfluxLog, Transaction]> {
        const address = opts.address;

        opts.startFrom = opts.startFrom || 0;
        opts.terminateOnSyncComplete = opts.terminateOnSyncComplete || true;
        opts.catchUpSleepPeriodSec = opts.catchUpSleepPeriodSec || 3;
        opts.maxEpochGap = opts.maxEpochGap || 1000;
        opts.epochCommitPeriod = opts.epochCommitPeriod || 10000;
        opts.label = opts.label || '';

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

        let lastEpoch = 0;

        for await (const { epoch, logs } of tracker) {
            // if there are logs, process them
            if (logs.length > 0) {
                opts.log && opts.log(`Found ${logs.length} logs in epoch ${epoch}`);

                const t = await this.db.transaction();

                try {
                    // yield to caller
                    for (const log of logs) {
                        yield [log, t];
                    }

                    // persist latest processed epoch
                    status.latest = epoch;
                    await status.save();

                    await t.commit();
                } catch (error) {
                    console.error(error);
                    await t.rollback();
                    return;
                }
            }

            // if there are no logs in this epoch,
            // we still commit our progress periodically
            else if (epoch % opts.epochCommitPeriod === 0) {
                status.latest = epoch;
                await status.save();
            }

            lastEpoch = epoch;
        }

        if (lastEpoch > 0) {
            status.latest = lastEpoch;
            await status.save();
        }
    }
}