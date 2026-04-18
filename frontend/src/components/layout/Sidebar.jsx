import { NavLink } from "react-router-dom";
import {
  House,
  Receipt,
  FileText,
  CreditCard,
  Users,
  Buildings,
  Package,
  BookOpen,
  Bank,
  ChartLineUp,
  NotePencil,
  UsersThree,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: House, end: true, testid: "sidebar-nav-dashboard" },
  { to: "/invoices", label: "Invoices", icon: FileText, testid: "sidebar-nav-invoices" },
  { to: "/bills", label: "Bills", icon: Receipt, testid: "sidebar-nav-bills" },
  { to: "/expenses", label: "Expenses", icon: CreditCard, testid: "sidebar-nav-expenses" },
  { to: "/customers", label: "Customers", icon: Users, testid: "sidebar-nav-customers" },
  { to: "/vendors", label: "Vendors", icon: Buildings, testid: "sidebar-nav-vendors" },
  { to: "/items", label: "Items & Services", icon: Package, testid: "sidebar-nav-items" },
  { to: "/accounts", label: "Chart of Accounts", icon: BookOpen, testid: "sidebar-nav-accounts" },
  { to: "/journal", label: "Journal Entries", icon: NotePencil, testid: "sidebar-nav-journal" },
  { to: "/banking", label: "Banking", icon: Bank, testid: "sidebar-nav-banking" },
  { to: "/reports", label: "Reports", icon: ChartLineUp, testid: "sidebar-nav-reports" },
];

const ADMIN_NAV = [
  { to: "/team", label: "Team", icon: UsersThree, testid: "sidebar-nav-team" },
];

export default function Sidebar({ orgName }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <aside
      className="w-[260px] shrink-0 border-r border-border bg-muted/30 h-screen sticky top-0 flex flex-col"
      data-testid="app-sidebar"
    >
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-heading font-bold">
            L
          </div>
          <div>
            <div className="font-heading font-bold text-lg leading-none text-primary">Ledgerly</div>
            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[170px]" data-testid="sidebar-org-name">
              {orgName || "My Company"}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-testid={testid}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Icon size={18} weight="duotone" />
            <span>{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Organization</div>
            {ADMIN_NAV.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={testid}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              >
                <Icon size={18} weight="duotone" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-border text-xs text-muted-foreground">
        <div className="font-medium">Fiscal Year 2026</div>
        <div>USD - United States Dollar</div>
      </div>
    </aside>
  );
}
