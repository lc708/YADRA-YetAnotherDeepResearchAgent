// TODO: 重新实现SiteHeader
// import { SiteHeader } from "../chat/components/site-header";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* TODO: 重新实现SiteHeader */}
      <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
