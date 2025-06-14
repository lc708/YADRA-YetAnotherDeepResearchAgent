// Copyright (c) 2025 YADRA


export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
