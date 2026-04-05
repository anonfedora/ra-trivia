"use client";

import { useState, useRef } from 'react';
import { X, FileUp, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import * as xlsx from 'xlsx';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [results, setResults] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
                toast('Please upload an Excel or CSV file', 'error');
                return;
            }
            setFile(selectedFile);
        }
    };

    const downloadTemplate = () => {
        const template = [
            {
                'Email Address': 'candidate@example.com',
                'Full Name': 'Joseph John',
                'Church': 'Gaskiya Baptist Church',
                'Association': 'Narayi Baptist Association',
                'Examination Type': 'Ambassador Rank Exams',
                'Password': 'Exams123!'
            }
        ];
        
        const ws = xlsx.utils.json_to_sheet(template);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Candidates');
        
        // Add note about valid types
        xlsx.utils.sheet_add_aoa(ws, [
            [],
            ['* Valid Examination Types:'],
            ['Ambassador Rank Exams'],
            ['Extraordinary Rank Exams'],
            ['Pre-Plenipotentiary Exams'],
            ['Plenipotentiary Rank Exams']
        ], { origin: -1 });

        xlsx.writeFile(wb, 'candidate_import_template.xlsx');
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch('admin/bulk-candidates', {
                method: 'POST',
                body: formData,
                // apiFetch handles Authorization header
            });

            const data = await res.json();
            if (res.ok) {
                setResults(data);
                if (data.success > 0) {
                    toast(`Successfully imported ${data.success} candidates`, 'success');
                    onSuccess();
                }
                if (data.failed > 0) {
                    toast(`Failed to import ${data.failed} candidates`, 'error');
                }
            } else {
                toast(data.message || 'Upload failed', 'error');
            }
        } catch (error) {
            toast('An error occurred during upload', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResults(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bulk Import Candidates</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Upload an Excel file to register multiple candidates at once.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    {!results ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <Download size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-blue-900 dark:text-blue-100 text-sm">Need a template?</p>
                                        <p className="text-blue-700 dark:text-blue-300 text-xs">Download the formatted Excel template to get started.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 bg-white dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all border border-blue-100 dark:border-blue-800"
                                >
                                    Download Template
                                </button>
                            </div>

                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-3 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all ${
                                    file 
                                        ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                }`}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    accept=".xlsx,.xls,.csv"
                                />
                                <div className={`w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center ${file ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                                    <FileUp size={32} />
                                </div>
                                {file ? (
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">{file.name}</p>
                                        <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">Click to upload or drag and drop</p>
                                        <p className="text-slate-500 text-sm">Excel (.xlsx, .xls) or CSV files supported</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={!file || isUploading}
                                    onClick={handleUpload}
                                    className="flex-[2] px-8 py-4 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Importing Candidates...
                                        </>
                                    ) : (
                                        'Start Import'
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 text-center">
                                    <CheckCircle2 className="mx-auto mb-2 text-emerald-600 dark:text-emerald-400" size={32} />
                                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{results.success}</p>
                                    <p className="text-emerald-600/70 dark:text-emerald-400/70 font-bold text-xs uppercase tracking-widest">Successful</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/30 text-center">
                                    <AlertCircle className="mx-auto mb-2 text-rose-600 dark:text-rose-400" size={32} />
                                    <p className="text-3xl font-black text-rose-700 dark:text-rose-400">{results.failed}</p>
                                    <p className="text-rose-600/70 dark:text-rose-400/70 font-bold text-xs uppercase tracking-widest">Failed</p>
                                </div>
                            </div>

                            {results.errors && results.errors.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-700">
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">Error Details</p>
                                    <ul className="space-y-2">
                                        {results.errors.map((err: string, i: number) => (
                                            <li key={i} className="text-xs text-rose-600 dark:text-rose-400 flex gap-2">
                                                <span className="shrink-0">•</span>
                                                <span>{err}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button 
                                    onClick={reset}
                                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
                                >
                                    Import Another File
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
