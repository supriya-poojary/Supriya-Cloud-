import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Upload, Grid as GridIcon, List as ListIcon, Filter, X, Search, Download, Check, RotateCcw, Cloud, Edit, Link as LinkIcon, Share2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/AuthContext';
const API_URL = import.meta.env.VITE_API_URL || '/api';

const FILTER_PRESETS = [
    { name: 'Normal', class: '', css: '' },
    { name: 'B&W', class: 'grayscale', css: 'grayscale(100%)' },
    { name: 'Sepia', class: 'sepia', css: 'sepia(100%)' },
    { name: 'Vintage', class: 'contrast-125 sepia-[.3] hue-rotate-[-10deg]', css: 'contrast(125%) sepia(30%) hue-rotate(-10deg)' },
    { name: 'Cool', class: 'hue-rotate-[30deg] contrast-110', css: 'hue-rotate(30deg) contrast(110%)' }
];

const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (isoString) => {
    if (!isoString) return 'Unknown Date';
    // Backend sends naive UTC string (e.g. "2023-10-27T10:00:00.000000")
    // If we pass this to new Date(), it often parses as Local.
    // We must ensure it is treated as UTC by appending 'Z' if missing.
    const safeDate = isoString.endsWith('Z') ? isoString : `${isoString}Z`;

    return new Date(safeDate).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default function Gallery({ refreshTrigger }) {
    console.log("Gallery Component Rendering"); // Debug Log

    const { currentUser } = useAuth();
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    // View States
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest'
    const [viewMode, setViewMode] = useState('grid'); // 'grid', 'grouped' (tags)
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImages, setSelectedImages] = useState(new Set());

    const fetchImages = async () => {
        if (!currentUser) return;
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/images`, { params: { user_id: currentUser } });

            const mapped = (res.data.images || []).map(item => ({
                id: item.image_id,
                ...item
            }));
            setImages(mapped);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load images");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, [refreshTrigger, currentUser]);

    const toggleSelection = (id) => {
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedImages.size} images?`)) return;

        const toastId = toast.loading("Deleting selected images...");
        const ids = Array.from(selectedImages);
        let successCount = 0;

        // Execute deletions sequentially (simpler for now) or parallel
        for (const id of ids) {
            try {
                await axios.delete(`${API_URL}/images/${id}`, {
                    params: { user_id: currentUser }
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to delete ${id}`, err);
            }
        }

        toast.dismiss(toastId);
        if (successCount > 0) {
            toast.success(`Deleted ${successCount} images`);
            setImages(prev => prev.filter(img => !selectedImages.has(img.image_id)));
            setSelectedImages(new Set()); // Clear selection
        } else {
            toast.error("Failed to delete images");
        }
    };

    const handleDelete = async (e, imageId) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this image?")) return;

        try {
            toast.loading("Deleting...");
            await axios.delete(`${API_URL}/images/${imageId}`, {
                params: { user_id: currentUser }
            });
            toast.dismiss();
            toast.success("Image deleted");
            setImages(prev => prev.filter(img => img.image_id !== imageId));
            setSelectedImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(imageId);
                return newSet;
            });
        } catch (err) {
            toast.dismiss();
            toast.error("Failed to delete");
        }
    };

    const handleShare = (e, url) => {
        e.stopPropagation();
        // Prefer navigator.share if mobile/supported
        if (navigator.share) {
            navigator.share({
                title: 'Check out this image!',
                url: url
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(url);
            toast.success("Image Link Copied!");
        }
    };

    const handleForceDownload = async (e, url, filename, filterCss) => {
        e.stopPropagation();
        const toastId = toast.loading("Downloading...");
        try {
            const response = await fetch(url);
            const blob = await response.blob();

            // If no filter, direct download
            if (!filterCss) {
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename || 'download.jpg';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
                toast.success("Download started", { id: toastId });
                return;
            }

            // Apply filter using Canvas
            const img = new Image();
            const objectUrl = window.URL.createObjectURL(blob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Apply the filter
                ctx.filter = filterCss;
                ctx.drawImage(img, 0, 0);

                // Determine mime type from filename
                const mimeType = filename?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

                canvas.toBlob((newBlob) => {
                    const blobUrl = window.URL.createObjectURL(newBlob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename || (mimeType === 'image/png' ? 'download.png' : 'download.jpg');
                    document.body.appendChild(a);
                    a.click();

                    // Cleanup
                    window.URL.revokeObjectURL(blobUrl);
                    window.URL.revokeObjectURL(objectUrl);
                    document.body.removeChild(a);
                    toast.success("Download started", { id: toastId });
                }, mimeType, 0.95);
            };

            img.onerror = () => {
                window.URL.revokeObjectURL(objectUrl);
                throw new Error("Failed to load image for processing");
            };

            img.src = objectUrl;

        } catch (err) {
            console.error(err);
            toast.error("Download failed", { id: toastId });
            // Fallback
            window.open(url, '_blank');
        }
    };

    const handleBackup = (e) => {
        e.stopPropagation();
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                loading: 'Backing up to Cloud...',
                success: 'Backup Successful!',
                error: 'Backup failed',
            }
        );
    };

    const handleRestore = (e) => {
        e.stopPropagation();
        toast.success("Image Restored (Simulation)");
    };



    const handleRename = (e, imageId, currentName) => {
        e.stopPropagation();
        const newName = prompt("Enter new name:", currentName);
        if (newName && newName !== currentName) {
            // Simulate rename
            setImages(prev => prev.map(img =>
                img.image_id === imageId ? { ...img, original_filename: newName } : img
            ));
            toast.success("Image renamed successfully");
        }
    };

    const GalleryImageCard = ({ item, onDelete, onDownload, onSelect, isSelected }) => {
        const [src, setSrc] = useState(null);
        const [showActions, setShowActions] = useState(false);
        const [activeFilter, setActiveFilter] = useState('');
        const [showFilterMenu, setShowFilterMenu] = useState(false);

        useEffect(() => {
            const getUrl = async () => {
                try {
                    const res = await axios.get(`${API_URL}/images/${item.image_id}/download`);
                    setSrc(res.data.download_url);
                } catch {
                    setSrc(null);
                }
            };
            getUrl();
        }, [item]);

        const handleCardClick = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                e.preventDefault();
                onSelect(item.image_id);
            } else {
                setSelectedImage({ src, ...item });
            }
        };

        if (!src) return <div className="w-full h-72 bg-slate-800/50 animate-pulse rounded-xl" />;

        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full h-72 group"
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => { setShowActions(false); setShowFilterMenu(false); }}
            >
                {/* Premium Card Style */}
                <div className="absolute inset-0 bg-[#0f1115] rounded-xl border border-white/10 overflow-hidden shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                    {/* Header Bar */}
                    <div className="h-8 bg-[#1a1d24] flex items-center px-3 gap-1.5 border-b border-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>

                    {/* Image Area */}
                    <div className={`relative h-[calc(100%-2rem)] p-2 ${selectedImages.has(item.image_id) ? 'bg-blue-500/20' : ''}`}>
                        <img
                            onClick={handleCardClick}
                            src={src}
                            className={`w-full h-full object-cover rounded-lg transition-all duration-300 cursor-pointer ${activeFilter} ${selectedImages.has(item.image_id) ? 'ring-4 ring-blue-500 scale-95' : ''}`}
                            alt=""
                        />

                        {/* Selection Indicator */}
                        {selectedImages.has(item.image_id) && (
                            <div className="absolute top-4 right-4 bg-blue-500 text-white rounded-full p-1 shadow-lg z-20 pointer-events-none">
                                <Check className="w-4 h-4" />
                            </div>
                        )}

                        {/* Hover Overlay Actions */}
                        <div
                            onClick={handleCardClick}
                            className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 transition-opacity duration-200 cursor-pointer ${showActions ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                        >

                            {/* Primary Actions Row */}
                            <div className="flex gap-3">
                                {selectedImages.size > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-bold shadow-lg"
                                    >
                                        <Trash2 size={18} />
                                        Delete ({selectedImages.size})
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        const activePreset = FILTER_PRESETS.find(p => p.class === activeFilter);
                                        // Ensure onDownload is defined before calling
                                        if (onDownload) onDownload(e, src, item.original_filename, activePreset?.css);
                                    }}
                                    className="p-2.5 rounded-full bg-white/10 hover:bg-blue-500/20 text-white hover:text-blue-400 border border-white/10 transition-all transform hover:scale-110"
                                    title="Download (JPG/PNG)"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowFilterMenu(!showFilterMenu); }}
                                    className={`p-2.5 rounded-full bg-white/10 hover:bg-purple-500/20 text-white hover:text-purple-400 border border-white/10 transition-all transform hover:scale-110 ${showFilterMenu ? 'bg-purple-500/20 text-purple-400' : ''}`}
                                    title="Apply Filters"
                                >
                                    <Filter className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => handleShare(e, src)}
                                    className="p-2.5 rounded-full bg-white/10 hover:bg-green-500/20 text-white hover:text-green-400 border border-white/10 transition-all transform hover:scale-110"
                                    title="Share Link"
                                >
                                    <LinkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Secondary Actions Row */}
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => handleRename(e, item.image_id, item.original_filename)}
                                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 flex items-center gap-1 transition-colors"
                                >
                                    <Edit className="w-3 h-3" /> Rename
                                </button>
                                <button
                                    onClick={handleBackup}
                                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 flex items-center gap-1 transition-colors"
                                >
                                    <Cloud className="w-3 h-3" /> Backup
                                </button>
                                <button
                                    onClick={(e) => onDelete(e, item.image_id)}
                                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-red-900/30 text-xs text-red-400 border border-white/10 flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" /> Delete
                                </button>
                            </div>

                            {/* Filter Menu Overlay */}
                            <AnimatePresence>
                                {showFilterMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute bottom-16 bg-[#1a1d24] border border-white/10 rounded-lg p-2 flex flex-col gap-1 w-32 shadow-xl z-20"
                                    >
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">Filters</span>
                                        {FILTER_PRESETS.map(filter => (
                                            <button
                                                key={filter.name}
                                                onClick={(e) => { e.stopPropagation(); setActiveFilter(filter.class); }}
                                                className={`text-left text-xs px-2 py-1.5 rounded hover:bg-white/10 transition-colors flex justify-between ${activeFilter === filter.class ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'}`}
                                            >
                                                {filter.name}
                                                {activeFilter === filter.class && <Check className="w-3 h-3" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>



                        </div>

                        {/* Tag Label - Always Visible */}
                        <span className="absolute bottom-3 left-3 flex flex-col items-start pointer-events-none z-10">
                            <span className="text-[10px] text-slate-200 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm shadow-sm mb-1">
                                {item.tag || '#untagged'}
                            </span>
                            <div className="flex gap-1">
                                <span className="text-[9px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                    {formatDate(item.upload_time)}
                                </span>
                                {item.file_size && (
                                    <span className="text-[9px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                        {formatBytes(item.file_size)}
                                    </span>
                                )}
                                {showDuplicates && item.duplicateCount > 1 && (
                                    <span className="text-[9px] text-red-200 bg-red-500/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm border border-red-500/30">
                                        {item.duplicateCount} Copies
                                    </span>
                                )}

                            </div>
                        </span>
                    </div>
                </div>
            </motion.div >
        );
    };

    return (
        <div className="w-full min-h-screen bg-black p-8 pt-24">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">My CloudBox</h2>
                        <p className="text-slate-400 text-sm">{images.length} items stored securely.</p>
                    </div>
                    {/* Refresh/Sort controls could go here */}
                </div>

                {/* View Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-20 z-30 py-2 bg-black/80 backdrop-blur-md rounded-lg px-4 border border-white/10">
                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or tag..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        <button
                            onClick={() => setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest')}
                            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors whitespace-nowrap"
                        >
                            <RotateCcw className={`w-3 h-3 ${sortBy === 'newest' ? '' : 'rotate-180 transition-transform'}`} />
                            {sortBy === 'newest' ? 'Recent' : 'Oldest'}
                        </button>

                        <button
                            onClick={() => setViewMode(prev => prev === 'grid' ? 'grouped' : 'grid')}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${viewMode === 'grouped' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                        >
                            <Filter className="w-3 h-3" />
                            {viewMode === 'grouped' ? 'Grouped' : 'Categorize'}
                        </button>

                        <button
                            onClick={() => setShowDuplicates(prev => !prev)}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${showDuplicates ? 'text-yellow-400 bg-yellow-500/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                        >
                            <Download className="w-3 h-3 rotate-45" />
                            {showDuplicates ? 'Duplicates' : 'Find Dups'}
                        </button>

                        {selectedImages.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors whitespace-nowrap shadow-lg shadow-red-500/20 animate-in fade-in slide-in-from-bottom-2"
                            >
                                <Trash2 className="w-3 h-3" />
                                Delete ({selectedImages.size})
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-72 bg-[#0f1115] rounded-xl border border-white/10 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="pb-20">
                        {(() => {
                            // 1. Sort
                            let processed = [...images].sort((a, b) => {
                                const tA = new Date(a.upload_time || 0).getTime();
                                const tB = new Date(b.upload_time || 0).getTime();
                                return sortBy === 'newest' ? tB - tA : tA - tB;
                            });

                            // 1.5 Search Filter
                            if (searchQuery) {
                                const q = searchQuery.toLowerCase();
                                processed = processed.filter(img =>
                                    (img.original_filename || '').toLowerCase().includes(q) ||
                                    (img.tag || '').toLowerCase().includes(q) ||
                                    (img.tags && Array.isArray(img.tags) && img.tags.some(t => t.toLowerCase().includes(q)))
                                );
                            }


                            // 2. Filter for "Show Duplicates" Mode (by tag name)
                            if (showDuplicates) {
                                const tagCounts = {};
                                processed.forEach(img => {
                                    const tag = img.tag || 'untagged';
                                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                                });

                                // Filter only images with duplicate tags and inject count
                                processed = processed.filter(img => {
                                    const tag = img.tag || 'untagged';
                                    return tagCounts[tag] > 1;
                                }).map(img => {
                                    const tag = img.tag || 'untagged';
                                    return { ...img, duplicateCount: tagCounts[tag] };
                                });

                                // Group duplicates together by tag
                                processed.sort((a, b) => {
                                    const tagA = a.tag || 'untagged';
                                    const tagB = b.tag || 'untagged';
                                    return tagA.localeCompare(tagB);
                                });

                                if (processed.length === 0) {
                                    return <div className="text-center text-slate-500 py-10">No duplicate tags found.</div>;
                                }
                            }


                            // 3. Render Views
                            if (viewMode === 'grouped' && !showDuplicates) {
                                // Group by Tag
                                const groups = {};
                                processed.forEach(img => {
                                    const tag = img.tag || 'Uncategorized';
                                    if (!groups[tag]) groups[tag] = [];
                                    groups[tag].push(img);
                                });

                                return (
                                    <div className="flex flex-col gap-10">
                                        {Object.entries(groups).map(([tag, groupImages]) => (
                                            <div key={tag}>
                                                <h3 className="text-xl font-semibold text-white mb-4 pl-2 border-l-4 border-blue-500">
                                                    {tag} <span className="text-sm font-normal text-slate-500 ml-2">({groupImages.length})</span>
                                                </h3>
                                                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                                    <AnimatePresence>
                                                        {groupImages.map(img => (
                                                            <GalleryImageCard
                                                                key={img.image_id}
                                                                item={img}
                                                                onDelete={handleDelete}
                                                                onDownload={handleForceDownload}
                                                                onSelect={toggleSelection}
                                                                isSelected={selectedImages.has(img.image_id)}
                                                            />
                                                        ))}
                                                    </AnimatePresence>
                                                </motion.div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            } else {
                                // Normal Grid
                                return (
                                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        <AnimatePresence>
                                            {processed.map(img => (
                                                <GalleryImageCard
                                                    key={img.image_id}
                                                    item={img}
                                                    onDelete={handleDelete}
                                                    onDownload={handleForceDownload}
                                                    onSelect={toggleSelection}
                                                    isSelected={selectedImages.has(img.image_id)}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            }
                        })()}
                    </div>
                )}



                {/* Full Screen Image Modal */}
                <AnimatePresence>
                    {selectedImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedImage(null)}
                            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="relative max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img
                                    src={selectedImage.src}
                                    alt="Full View"
                                    className="w-full h-full max-h-[90vh] object-contain rounded-xl"
                                />

                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <h3 className="text-white text-xl font-bold mb-1">
                                                {selectedImage.original_filename || 'Untitled'}
                                            </h3>
                                            <div className="flex gap-2">
                                                <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm border border-blue-500/20 backdrop-blur-sm">
                                                    {selectedImage.tag || '#untagged'}
                                                </span>
                                                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-slate-300 text-sm backdrop-blur-sm">
                                                    {formatDate(selectedImage.upload_time)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
