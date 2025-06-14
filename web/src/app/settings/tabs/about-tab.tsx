// Copyright (c) 2025 YADRA

import { BadgeInfo } from "lucide-react";

import { Markdown } from "~/components/yadra/markdown";

import about from "./about.md";
import type { Tab } from "./types";

export const AboutTab: Tab = () => {
  return <Markdown>{about}</Markdown>;
};
AboutTab.icon = BadgeInfo;
