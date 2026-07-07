import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'ClinicOS AI — We don\u2019t manage clinics. We grow them.',
  description: 'AI growth layer for Indian clinics: patient recall, reputation, revenue recovery.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
