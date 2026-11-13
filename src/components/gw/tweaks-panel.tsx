"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

/** The same preferences screen owns appearance from every dashboard. */
export function TweaksPanel() {
  return (
    <Link className="gw-icon-btn" href="/student/settings" aria-label="Minhas preferências" title="Minhas preferências">
      <Settings size={18} />
    </Link>
  );
}
