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
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo 区域 */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">YADRA</div>
          <div className="text-xs text-gray-500">深度研究助手</div>
        </div>
      </div>

      {/* 导航区域 */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                item.current
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                item.disabled && "cursor-not-allowed opacity-50"
              )}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                }
              }}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  item.current ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
                )}
              />
              <span className="truncate">{item.name}</span>
              {item.disabled && (
                <span className="ml-auto text-xs text-gray-400">敬请期待</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部区域 */}
      <div className="border-t border-gray-200 p-4">
        <div className="text-center">
          <div className="text-xs text-gray-400">v1.0.0</div>
        </div>
      </div>
    </div>
  );
} 