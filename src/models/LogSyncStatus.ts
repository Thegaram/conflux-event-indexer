import { AllowNull, Column, Model, Table, Unique } from 'sequelize-typescript';

@Table({ tableName: 'conflux_event_indexer_log_sync_status', timestamps: true })
export class LogSyncStatus extends Model {
    @AllowNull(false)
    @Unique(true)
    @Column
    address: string;

    @AllowNull(false)
    @Column
    earliest: number;

    @AllowNull(false)
    @Column
    latest: number;
}
