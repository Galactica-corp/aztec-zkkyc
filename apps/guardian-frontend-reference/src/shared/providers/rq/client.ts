import { QueryClient } from "@tanstack/react-query";

export const rqClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: (error) => {
        if (import.meta.env.DEV) {
          console.error(error);
        }
        return false;
      },
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
