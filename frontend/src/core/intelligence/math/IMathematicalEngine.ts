export interface IMathematicalEngine {
    id: string;
    name: string;
    version: string;
    supported_inputs: string[];
    supported_outputs: string[];
    execution_contract: 'pure' | 'stateful' | 'stochastic';
    execute(inputs: any): any;
}