// Copyright (c) 2025 YADRA

import { GithubFilled } from "@ant-design/icons";
import Link from "next/link";

import { AuroraText } from "~/components/magicui/aurora-text";
import { Button } from "~/components/ui/button";

import { SectionHeader } from "../components/section-header";

export function JoinCommunitySection() {
  return (
    <section className="flex w-full flex-col items-center justify-center pb-12">
      <SectionHeader
        anchor="join-community"
        title={
          <AuroraText colors={["#60A5FA", "#A5FA60", "#A560FA"]}>
            Join the YADRA Community
          </AuroraText>
        }
        description="Contribute brilliant ideas to shape the future of YADRA. Collaborate, innovate, and make impacts."
      />
      <Button className="text-xl" size="lg" asChild>
        <Link href="https://github.com/{space_holder}/yadra" target="_blank">
          <GithubFilled />
          Contribute Now
        </Link>
      </Button>
    </section>
  );
}
