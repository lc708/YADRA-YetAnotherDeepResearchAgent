import { useMemo } from "react";
import { useUnifiedStore } from "~/core/store/unified-store";
import { Tooltip } from "./tooltip";
import { WarningFilled } from "@ant-design/icons";

export const Link = ({
  href,
  children,
  checkLinkCredibility = false,
}: {
  href: string | undefined;
  children: React.ReactNode;
  checkLinkCredibility: boolean;
}) => {
  const responding = useUnifiedStore((state) => state.responding);

  const credibleLinks = useMemo(() => {
    const links = new Set<string>();
    if (!checkLinkCredibility) return links;

    // TODO: Implement toolCalls tracking in unified store if needed
    return links;
  }, [checkLinkCredibility]);

  const isCredible = useMemo(() => {
    return checkLinkCredibility && href && !responding
      ? credibleLinks.has(href)
      : true;
  }, [credibleLinks, href, responding, checkLinkCredibility]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
      {!isCredible && (
        <Tooltip
          title={
            <div className="flex flex-col items-center">
              <p className="text-center">
                This link is not mentioned in the research results
              </p>
              <p className="text-center">
                It may not be a credible source
              </p>
            </div>
          }
          delayDuration={300}
        >
          <WarningFilled className="text-yellow-500" />
        </Tooltip>
      )}
    </span>
  );
};
