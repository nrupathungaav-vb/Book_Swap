import { ArrowLeftRight, BookOpen, Compass, Heart, LayoutDashboard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/books", label: "My books", icon: BookOpen },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/matches", label: "Matches", icon: Sparkles },
  { href: "/swaps", label: "Swaps", icon: ArrowLeftRight },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/books")
    return pathname === "/books" || pathname.startsWith("/books/new") || pathname.endsWith("/edit");
  return pathname === href || pathname.startsWith(`${href}/`);
}
