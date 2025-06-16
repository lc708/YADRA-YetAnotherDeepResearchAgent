import { type YADRAConfig } from "../config";

import { resolveServiceURL } from "./resolve-service-url";

declare global {
  interface Window {
    __yadraConfig: YADRAConfig;
  }
}

export async function loadConfig() {
    const res = await fetch(resolveServiceURL("./config"));
    const config = await res.json();
    return config;
  }
  
  export function getConfig(): YADRAConfig {
    if (
      typeof window === "undefined" ||
      typeof window.__yadraConfig === "undefined"
    ) {
      throw new Error("Config not loaded");
    }
    return window.__yadraConfig;
  }