import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import Bills from "@/pages/Bills";
import BillForm from "@/pages/BillForm";
import Expenses from "@/pages/Expenses";
import ContactList from "@/pages/ContactList";
import Items from "@/pages/Items";
import Accounts from "@/pages/Accounts";
import JournalEntries from "@/pages/JournalEntries";
import Banking from "@/pages/Banking";
import Reports from "@/pages/Reports";
import Team from "@/pages/Team";
import PublicInvoice from "@/pages/PublicInvoice";

function Shell() {
  const { user, loading } = useAuth();
  useEffect(() => {}, [user]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading your workspace...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/share/invoice/:token" element={<PublicInvoice />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/bills/new" element={<BillForm />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/new" element={<Expenses />} />
        <Route path="/customers" element={<ContactList kind="customer" />} />
        <Route path="/customers/new" element={<ContactList kind="customer" />} />
        <Route path="/vendors" element={<ContactList kind="vendor" />} />
        <Route path="/vendors/new" element={<ContactList kind="vendor" />} />
        <Route path="/items" element={<Items />} />
        <Route path="/items/new" element={<Items />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/journal" element={<JournalEntries />} />
        <Route path="/banking" element={<Banking />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/team" element={<Team />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Shell />
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
