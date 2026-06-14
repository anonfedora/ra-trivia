import Link from "next/link";
import { AdminQRScanner } from "@/components/attendance/AdminQRScanner";
import { Button } from "@/components/ui/button";
import { UserPlus, List, ArrowLeft, Printer } from "lucide-react";

export default function AttendanceGeneralPage() {
  return (
    <div className="container mx-auto py-12">
      <div className="flex flex-col gap-4 mb-12 max-w-6xl mx-auto">
        <Link 
          href="/admin/dashboard" 
          className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all w-fit"
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
              Attendance check-in
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Scan candidate IDs or manually record attendance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/candidates/register">
              <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                <UserPlus className="w-4 h-4" />
                Register Single
              </Button>
            </Link>
            <Link href="/admin/candidates/print-qrs">
              <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900">
                <Printer className="w-4 h-4" />
                Print IDs
              </Button>
            </Link>
            <Link href="/attendance/manual">
              <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="w-4 h-4" />
                Manual Entry
              </Button>
            </Link>
            <Link href="/attendance/list">
              <Button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                <List className="w-4 h-4" />
                View Records
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <AdminQRScanner />
      </div>
    </div>
  );
}
