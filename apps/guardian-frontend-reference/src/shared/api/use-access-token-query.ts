import { useQuery } from "@tanstack/react-query";

import { apiBaseUrl } from "./base-url";

type Params = { userAddress: string | undefined };

export const useAccessTokenQuery = (params: Params) => {
  const { userAddress } = params;
  return useQuery({
    queryKey: ["access-token", userAddress],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/access-token`, {
        method: "POST",
        body: JSON.stringify({ userAddress }),
      });
      const data: string = await response.json();
      return data;
    },
    enabled: Boolean(userAddress),
  });
};
