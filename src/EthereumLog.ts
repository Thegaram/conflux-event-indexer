export type EthereumLog = {
    readonly address: string;
    readonly blockHash: string;
    readonly data: string;
    readonly blockNumber: number;
    readonly logIndex: number;
    readonly topics: readonly string[];
    readonly transactionHash: string;
    readonly transactionIndex: number;
    readonly type: string;
};
