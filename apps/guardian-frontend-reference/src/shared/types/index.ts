/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentPropsWithoutRef, ElementType } from "react";

import type {
  DefaultError,
  QueryKey,
  UndefinedInitialDataOptions,
  UseMutationOptions,
} from "@tanstack/react-query";

export type ClassName = {
  className?: string;
};

export type DistributiveOmit<T, TOmitted extends PropertyKey> = T extends any
  ? Omit<T, TOmitted>
  : never;

type AsProp<E extends ElementType> = {
  as?: E;
};

export type PolymorphicProps<
  E extends ElementType,
  P = Record<string, unknown>,
> = AsProp<E> &
  P &
  DistributiveOmit<ComponentPropsWithoutRef<E>, keyof AsProp<E> | keyof P>;

export type QueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
  "queryFn" | "queryKey"
>;

export type MutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn">;

export type GetKey<T extends ((...params: any[]) => QueryKey) | QueryKey> =
  T extends (...params: any[]) => any ? ReturnType<T> : T;
