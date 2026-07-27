type RpcError = {
  code?: string;
  message?: string;
};

type RpcResponse = {
  data: unknown;
  error: RpcError | null;
};

type RpcClient = {
  rpc: (
    functionName: string,
    arguments_: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};

export function callUntypedRpc(
  client: unknown,
  functionName: string,
  arguments_: Record<string, unknown> = {},
): PromiseLike<RpcResponse> {
  return (client as RpcClient).rpc(functionName, arguments_);
}
