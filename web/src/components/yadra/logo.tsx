// Copyright (c) 2025 YADRA
// SPDX-License-Identifier: MIT

import Link from "next/link";

export function Logo() {
  return (
    <Link
      className="opacity-70 transition-opacity duration-300 hover:opacity-100"
      href="/"
    >
      🚀 YADRA
    </Link>
  );
}
