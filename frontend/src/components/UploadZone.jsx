import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, X, File, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function UploadZone({ onUploadComplete }) {
    const { currentUser } = useAuth();
    const [files, setFiles] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles?.length > 0) {
            // Append new files to existing ones, avoiding duplicates by name
            setFiles(prev => {
                const newFiles = acceptedFiles.filter(f => !prev.some(p => p.name === f.name));
                return [...prev, ...newFiles];
            });
            // Don't reset tags, let them apply to the batch
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 50, // Allow bulk upload
        multiple: true
    });

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const removeFile = (fileName) => {
        setFiles(files.filter(f => f.name !== fileName));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setUploading(true);
        setProgress(0);

        let completed = 0;
        const total = files.length;
        const failed = [];

        try {
            // Upload files sequentially or in small parallel batches
            // For simplicity and progress tracking, we'll do sequential here but fast
            for (const file of files) {
                try {
                    // 1. Unified Upload: Get Presigned URL & Save Metadata
                    const finalTags = [...tags];
                    if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
                        finalTags.push(tagInput.trim());
                    }

                    const initRes = await axios.post(`${API_URL}/images/upload`, {
                        filename: file.name,
                        content_type: file.type,
                        file_size: file.size,
                        user_id: currentUser,
                        tags: finalTags,
                        tag: finalTags[0] || 'uncategorized',
                        description: `Batch upload on ${new Date().toLocaleDateString()}`
                    });

                    const { upload_url } = initRes.data;

                    // 2. Upload to S3
                    await axios.put(upload_url, file, {
                        headers: { 'Content-Type': file.type },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            // This progress is for the current file.
                            // To show overall progress, we'd need a more complex calculation
                            // involving `completed` files and current file's progress.
                            // For now, we'll just update based on completed files.
                        }
                    });

                    completed++;
                    setProgress((completed / total) * 100);
                    toast.success(`Uploaded: ${file.name}`);
                } catch (err) {
                    console.error(err);
                    toast.error(`Failed to upload ${file.name}`);
                    failed.push(file.name);
                }
            }

            if (failed.length === 0) {
                toast.success(`Successfully uploaded ${total} images!`);
            } else if (completed > 0) {
                toast.warning(`Uploaded ${completed}/${total} images. Failed: ${failed.join(', ')}`);
            } else {
                toast.error("Failed to upload images.");
            }

            if (onUploadComplete) onUploadComplete();

            // Reset
            setTimeout(() => {
                setFiles([]);
                setTags([]);
                setTagInput('');
                setUploading(false);
                setProgress(0);
            }, 1000);

        } catch (error) {
            console.error("Batch upload error:", error);
            toast.error("Critical upload error occurred.");
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                layout
                className={cn(
                    "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 transition-all duration-300",
                    isDragActive ? "bg-white/10 ring-2 ring-blue-500/50" : "hover:bg-white/10"
                )}
            >
                <input {...getInputProps()} />
                {files.length === 0 ? (
                    <div {...getRootProps()} className="flex flex-col items-center justify-center h-64 cursor-pointer">
                        <div className="p-4 rounded-full bg-blue-500/10 mb-4 animate-pulse">
                            <UploadCloud className="w-10 h-10 text-blue-400" />
                        </div>
                        <p className="text-lg font-medium text-white mb-2">
                            {isDragActive ? "Drop files here!" : "Drag & drop multiple images"}
                        </p>
                        <p className="text-sm text-slate-400">or click to browse</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* File List Summary */}
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="flex justify-between items-center text-slate-400 text-sm mb-2">
                                <span>{files.length} files selected</span>
                                <button onClick={() => setFiles([])} className="text-red-400 hover:text-red-300 text-xs">Clear All</button>
                            </div>

                            <AnimatePresence>
                                {files.map(file => (
                                    <motion.div
                                        key={file.name}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    className="w-full h-full object-cover opacity-80"
                                                    alt="preview"
                                                />
                                            </div>
                                            <div className="truncate">
                                                <p className="font-medium text-white text-sm truncate">{file.name}</p>
                                                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        {!uploading && (
                                            <button
                                                onClick={() => removeFile(file.name)}
                                                className="p-1.5 hover:bg-slate-700/50 rounded-full transition-colors flex-shrink-0"
                                            >
                                                <X className="w-4 h-4 text-slate-400" />
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Tags Input */}
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">Apply Tags to All</label>
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                disabled={uploading}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
                                placeholder="holiday, work, 2024..."
                            />
                            <div className="flex flex-wrap gap-2 mt-3">
                                <AnimatePresence>
                                    {tags.map(tag => (
                                        <motion.span
                                            key={tag}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm border border-blue-500/20 flex items-center gap-2"
                                        >
                                            {tag}
                                            {!uploading && (
                                                <button onClick={() => removeTag(tag)}><X className="w-3 h-3 hover:text-white" /></button>
                                            )}
                                        </motion.span>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Progress Bar or Upload Button */}
                        {uploading ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Uploading Batch...</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    {...getRootProps()}
                                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all border border-white/10"
                                >
                                    Add More
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98]"
                                >
                                    Upload {files.length} Images
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
