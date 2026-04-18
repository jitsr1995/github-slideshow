import { useNavigate } from "react-router-dom";
import { Plus, SignOut, User as UserIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header
      className="h-16 sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-6"
      data-testid="app-topbar"
    >
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</div>
        <div className="font-heading text-xl font-bold text-primary" data-testid="topbar-user-greeting">
          {user?.name || "there"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
              data-testid="topbar-quick-create-btn"
            >
              <Plus size={16} weight="bold" className="mr-1" /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Quick create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => nav("/invoices/new")} data-testid="quick-create-invoice">
              Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/bills/new")} data-testid="quick-create-bill">
              Bill
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/expenses/new")} data-testid="quick-create-expense">
              Expense
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/customers/new")} data-testid="quick-create-customer">
              Customer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/vendors/new")} data-testid="quick-create-vendor">
              Vendor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav("/items/new")} data-testid="quick-create-item">
              Item / Service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground font-heading font-bold flex items-center justify-center hover:bg-secondary/80 transition"
              data-testid="topbar-user-menu-trigger"
              aria-label="User menu"
            >
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-semibold">{user?.name}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon size={16} className="mr-2" />
              Profile (coming soon)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} data-testid="topbar-logout">
              <SignOut size={16} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
