import type { Resource } from "../messages";

import { resolveServiceURL } from "./resolve-service-url";

export function queryRAGResources(query: string) {
  const params = new URLSearchParams({ query });
  return fetch(resolveServiceURL(`rag/resources?${params}`), {
    method: "GET",
  })
    .then((res) => res.json())
    .then((res) => {
      return res.resources as Array<Resource>;
    })
    .catch(() => {
      return [];
    });
}