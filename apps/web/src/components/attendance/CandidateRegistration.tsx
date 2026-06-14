"use client";

import { useState } from "react";
import Image from "next/image";
import { attendanceAPI, CandidateRegisterRequest } from "@/lib/api/attendance";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, QrCode, Download, User } from "lucide-react";
import Link from "next/link";

const CHURCHES = [
  "Aniya Baptist Church",
  "Alheri Baptist Church",
  "First Baptist Church",
  "Gaskiya Baptist Church",
  "Glory Baptist Church",
  "Nagarta Baptist Church",
  "Praise Baptist Church",
  "United English Baptist Church",
  "Wisdom Baptist Church",
  "Zion Baptist Church",
];

export function CandidateRegistration() {
  const [formData, setFormData] = useState<CandidateRegisterRequest>({
    name: "",
    email: "",
    church: "",
    phoneNumber: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await attendanceAPI.registerCandidate(formData);
      setResult(response);
      toast("Candidate registered successfully!", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to register candidate",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!result) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Candidate ID - ${result.candidate.fullName}</title>
          <style>
            body { 
              font-family: sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
            }
            .id-card {
              width: 3.5in;
              height: 2.5in;
              border: 2px solid #333;
              padding: 15px;
              text-align: center;
              border-radius: 10px;
              background: white;
            }
            .qr-code { width: 1.5in; height: 1.5in; }
            .name { font-size: 18px; font-weight: bold; margin-top: 10px; }
            .details { font-size: 12px; color: #666; margin-top: 5px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="id-card">
            <img class="qr-code" src="${result.qrCode}" />
            <div class="name">${result.candidate.fullName}</div>
            <div class="details">${result.candidate.church || ""}</div>
            <div class="details">${result.identityCode}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto p-4">
      <Card className="shadow-lg border-slate-200 dark:border-slate-700">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="w-6 h-6 text-primary" />
            Candidate Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Enter email address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="church">Church</Label>
              <Select
                    value={formData.church || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, church: e.target.value })
                    }
                  >
                    <option value="">Select a church</option>
                    {CHURCHES.map((church) => (
                      <option key={church} value={church}>
                        {church}
                      </option>
                    ))}
                  </Select>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-primary hover:bg-primary/90 py-6 text-lg font-bold"
            >
              {isSubmitting ? "Registering..." : "Register Candidate"}
            </Button>

            <div className="flex justify-center mt-4">
              <Link
                href="/admin/candidates"
                className="text-sm text-slate-500 hover:text-primary underline"
              >
                Back to All Candidates
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {result ? (
          <Card className="shadow-lg border-green-200 dark:border-green-900 overflow-hidden">
            <CardHeader className="bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/30">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <QrCode className="w-6 h-6" />
                Identity Generated
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
              <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-slate-100 mb-6">
                <Image
                  src={result.qrCode}
                  alt="Candidate QR Code"
                  width={192} // 48 * 4
                  height={192} // 48 * 4
                  className="w-48 h-48"
                />
              </div>

              <div className="space-y-2 mb-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {result.candidate.fullName}
                </h3>
                {result.candidate.email && (
                  <p className="text-slate-500 dark:text-slate-400 font-medium">
                    {result.candidate.email}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">
                    ID: {result.identityCode}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 w-full max-w-xs">
                <Button
                  onClick={handlePrint}
                  className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800"
                >
                  <QrCode className="w-4 h-4" />
                  Print ID
                </Button>
                <a
                  href={result.qrCode}
                  download={`qr-${result.candidate.fullName.replace(
                    /\s+/g,
                    "-"
                  )}.png`}
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full gap-2 border-2">
                    <Download className="w-4 h-4" />
                    Save QR
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
            <CardContent className="text-center p-12">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-400 dark:text-slate-600">
                Register a candidate to generate their QR Identity
              </h3>
              <p className="text-slate-400 dark:text-slate-600 mt-2 max-w-xs mx-auto">
                Once registered, you can print their identity card or save the QR code for future use.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
