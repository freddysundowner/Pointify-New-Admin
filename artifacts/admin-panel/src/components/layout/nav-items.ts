import {
  LayoutDashboard, Users, Store, PackageSearch,
  UserSquare2, ReceiptText, ShoppingCart, Package,
  CreditCard, MessageSquare, Settings, BarChart3, Tags, Handshake,
  Sparkles, Target,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Statistics", href: "/statistics", icon: BarChart3 },
  { title: "Platform Users", href: "/users", icon: Users },
  { title: "Shops", href: "/shops", icon: Store },
  { title: "Shop Categories", href: "/categories", icon: Tags },
  { title: "Partners", href: "/partners", icon: Handshake },
  { title: "Leads", href: "/leads", icon: Target },
  { title: "Products", href: "/products", icon: PackageSearch },
  { title: "Attendants", href: "/attendants", icon: UserSquare2 },
  { title: "Sales", href: "/sales", icon: ReceiptText },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart },
  { title: "Packages", href: "/packages", icon: Package },
  { title: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { title: "SMS Hub", href: "/sms", icon: MessageSquare },
  { title: "AI Insights", href: "/ai-logs", icon: Sparkles },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function isNavActive(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href));
}

export const primaryMobileHrefs = ["/", "/shops", "/users", "/subscriptions"];
