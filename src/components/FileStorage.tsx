import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { FileMeta, User } from '../types';
import {
  UploadCloud,
  File,
  Download,
  Loader2,
  Share2,
  Trash2,
  Info,
  ShieldAlert
} from 'lucide-react';

interface FileStorageProps {
  workspaceId: string;
  initialFiles: FileMeta[];
  currentUser: User;
}

export default function FileStorage({ workspaceId, initialFiles, currentUser }: FileStorageProps) {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const socket = getSocket();

  useEffect(() => {
    setFiles(initialFiles);

    // Live sync for file uploads
    socket.on('file_uploaded', (newFile: FileMeta) => {
      if (newFile.workspaceId === workspaceId) {
        setFiles(prev => {
          if (prev.some(f => f._id === newFile._id)) return prev;
          return [newFile, ...prev];
        });
      }
    });

    return () => {
      socket.off('file_uploaded');
    };
  }, [workspaceId, initialFiles]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const savedMeta = await api.files.upload(workspaceId, file);
      
      // Emit websocket trigger to update others in room
      socket.emit('file_upload', savedMeta);

      setFiles(prev => [savedMeta, ...prev]);
    } catch (err) {
      console.error('File upload failed:', err);
      setError('Failed to upload file. Make sure file is valid and under 10MB.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper to format bytes to human readable sizes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6" id="files-panel">
      {/* File Storage Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4" id="files-header">
        <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-xl">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900 text-sm">Shared Resources & Files</h3>
          <p className="text-slate-400 text-[10px] font-medium leading-none mt-1">Upload slides, reports, and code snippets</p>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 font-bold px-1">&times;</button>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
          dragActive
            ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-50 shadow-inner'
            : 'border-slate-200 bg-slate-50 hover:bg-slate-50/50 hover:border-slate-300'
        }`}
        id="drag-drop-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          id="file-element"
        />

        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Uploading file metadata to workspace...</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-indigo-500">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs mx-auto">
              <h4 className="text-xs font-bold text-slate-800">Drag & Drop File Here</h4>
              <p className="text-[10px] text-slate-400 leading-normal">
                Or click to browse from explorer. Max 10MB per file.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Uploaded Files Table */}
      <section id="files-list-section">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
          <span className="text-xs font-bold text-slate-800 uppercase font-display">Shared Assets Folder</span>
          <span className="text-[10px] text-slate-400 font-bold font-mono bg-slate-100 px-2 py-0.5 rounded-full">
            {files.length} Assets
          </span>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
            <File className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No shared assets folder found</p>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Drag and drop slides, assignments, or PDF worksheets above to share them with other members.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm" id="files-table-card">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs" id="files-table">
              <thead className="bg-slate-50 font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">File Name</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Uploader</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium" id="files-table-body">
                {files.map((file) => (
                  <tr key={file._id} className="hover:bg-slate-50/50" id={`file-row-${file._id}`}>
                    <td className="px-5 py-4 flex items-center gap-3">
                      <div className="bg-slate-100 text-slate-500 p-1.5 rounded-lg border border-slate-200/50">
                        <File className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-800 max-w-[180px] truncate" title={file.originalName}>
                        {file.originalName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{formatBytes(file.size)}</td>
                    <td className="px-5 py-4 text-slate-600">{file.uploaderName}</td>
                    <td className="px-5 py-4 text-slate-400 font-mono text-[10px]">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={api.files.getDownloadUrl(file.filename)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        title="Download Asset"
                        download
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
