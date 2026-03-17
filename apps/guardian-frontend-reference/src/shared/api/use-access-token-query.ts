import { useQuery } from "@tanstack/react-query";

type Params = { userAddress: string | undefined };

export const useAccessTokenQuery = (params: Params) => {
  const { userAddress } = params;
  return useQuery({
    queryKey: ["access-token", userAddress],
    queryFn: async () => {
      const response = await fetch("/api/v1/access-token", {
        method: "POST",
        body: JSON.stringify({ userAddress }),
      });
      const data: string = await response.json();
      return data;
    },
    enabled: Boolean(userAddress),
  });
};
