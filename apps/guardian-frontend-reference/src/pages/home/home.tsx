import { useSearchParams } from "react-router";

import SumsubWebSdk from "@sumsub/websdk-react";

import { useAccessTokenQuery } from "../../shared/api/use-access-token-query";

type MessageData = {
  applicantId: string;
};

export const Home = () => {
  const [searchParams] = useSearchParams();
  const userAddress = searchParams.get("userAddress");
  const query = useAccessTokenQuery({
    userAddress: userAddress ?? undefined,
  });

  if (!userAddress) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">
          Provide your Aztec address in the URL to start KYC.
        </p>
        <p className="mt-2 font-mono text-sm">
          Example: <code>?userAddress=0x...</code>
        </p>
      </div>
    );
  }

  return (
    <>
      {query.isError && (
        <div className="p-4 text-destructive">
          {query.error instanceof Error
            ? query.error.message
            : String(query.error)}
        </div>
      )}
      {query.isPending && <div>Loading...</div>}
      {query.isSuccess && (
        <SumsubWebSdk
          className="min-h-dvh [&>iframe]:min-h-dvh"
          accessToken={query.data}
          expirationHandler={query.refetch}
          onMessage={(_message: string, _params: MessageData) => {}}
          onError={(error: unknown) => {
            console.error(error);
          }}
        />
      )}
    </>
  );
};
