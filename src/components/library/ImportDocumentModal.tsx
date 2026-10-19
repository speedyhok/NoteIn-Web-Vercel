import React, { useState, useRef } from 'react';
import type { Notebook } from '../../types';
import { Modal } from '../common/Modal';
import { importAnyDocument } from '../../services/documentImporter';
import {
  Upload,
  FileText,
  FileCode,
  FileImage,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface ImportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (notebook: Notebook) => void;
}

export const ImportDocumentModal: React.FC<ImportDocumentModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setProgress(null);
    setErrorMessage(null);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await importAnyDocument(selectedFile, (current, total) => {
        setProgress({ current, total });
      });

      onImportSuccess(res.notebook);
      resetState();
      onClose();
    } catch (err: any) {
      console.error('Document import failed:', err);
      setErrorMessage(err.message || 'Failed to import document');
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) {
          resetState();
          onClose();
        }
      }}
      title="Upload & Import Document"
      maxWidth="620px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleStartImport}
            disabled={!selectedFile || isProcessing}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: !selectedFile || isProcessing ? 'var(--border-strong)' : 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              gap: '6px',
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {progress ? `Importing Page ${progress.current} of ${progress.total}...` : 'Processing Document...'}
              </>
            ) : (
              <>
                <Upload size={14} />
                Import to Studio
              </>
            )}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.notein,.in,.json,.png,.jpg,.jpeg,.webp,.svg,.md,.txt,.docx"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />

        {/* Drag & Drop Target Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: isDragging ? 'var(--accent-light)' : 'var(--bg-secondary)',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upload size={24} />
          </div>

          <div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
              Drag and drop your file here, or <span style={{ color: 'var(--accent-primary)' }}>browse</span>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Supports PDF, NoteIn (.notein/.in), Images, Markdown (.md), and Text (.txt)
            </span>
          </div>
        </div>

        {/* Selected File Card */}
        {selectedFile && (
          <div
            className="animate-scale-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} color="var(--accent-primary)" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {formatFileSize(selectedFile.size)} • Ready to import
                </span>
              </div>
            </div>

            {!isProcessing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                style={{ padding: '4px', color: 'var(--text-muted)' }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Multi-Page Progress Bar */}
        {isProcessing && progress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Rendering PDF pages...</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#dc2626',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            {errorMessage}
          </div>
        )}

        {/* Supported Formats Feature Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={15} />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>PDF Documents</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Annotate & highlight pages</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={15} />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>NoteIn Packages</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>.notein & .in native backups</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileImage size={15} />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Images & Photos</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PNG, JPG, WebP photos</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCode size={15} />
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Markdown & Text</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MD notes with code blocks</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
