"use client";

import { Home, Briefcase, Settings, User, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export function GlobalSidebar() {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "首页",
      href: "/",
      icon: Home,
      current: pathname === "/",
    },
    {
      name: "工作区",
      href: "/workspace",
      icon: Briefcase,
      current: pathname.startsWith("/workspace"),
    },
    {
      name: "配置",
      href: "/settings",
      icon: Settings,
      current: pathname.startsWith("/settings"),
      disabled: true, // 预留功能
    },
    {
      name: "个人中心",
      href: "/profile",
      icon: User,
      current: pathname.startsWith("/profile"),
      disabled: true, // 预留功能
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* LOGO和标题 */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">YADRA</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">深度研究助手</p>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.name}
              variant={item.current ? "default" : "ghost"}
              size="sm"
              className={cn(
                "w-full justify-start gap-3 h-10",
                item.disabled && "opacity-50 cursor-not-allowed"
              )}
              asChild={!item.disabled}
              disabled={item.disabled}
            >
              {item.disabled ? (
                <div>
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                  <span className="ml-auto text-xs text-gray-400">(即将推出)</span>
                </div>
              ) : (
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )}
            </Button>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>版本 1.0.0</p>
          <p className="mt-1">© 2025 YADRA</p>
        </div>
      </div>
    </div>
  );
} 