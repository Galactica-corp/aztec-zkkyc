import { type PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { rqClient } from "./client";

export const Provider = ({ children }: PropsWithChildren) => {
  return (
    <QueryClientProvider client={rqClient}>{children}</QueryClientProvider>
  );
};
