export type ConfluxLog = {
    readonly address: string;
    readonly blockHash: string;
    readonly data: string;
    readonly epochNumber: number;
    readonly logIndex: number;
    readonly topics: readonly string[];
    readonly transactionHash: string;
    readonly transactionIndex: number;
    readonly transactionLogIndex: number;
};
