// Copyright (c) 2025 YADRA

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
