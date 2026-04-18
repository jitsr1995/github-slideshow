import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout() {
  const { org } = useAuth();
  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar orgName={org?.name} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-8 py-8" data-testid="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
