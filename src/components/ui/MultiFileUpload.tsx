'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

interface MultiFileUploadProps {
  label?: string;
  onChange: (files: File[]) => void;
  value?: File[];
  accept?: string;
  className?: string;
  helperText?: string;
  maxFiles?: number;
}

export default function MultiFileUpload({
  label,
  onChange,
  value = [],
  accept = "image/*,video/*",
  className = "",
  helperText = "Arrastra y suelta o haz clic para seleccionar",
  maxFiles = 10
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      addFiles(newFiles);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
    // Reset input so same files can be selected again if needed
    if (inputRef.current) inputRef.current.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    const totalFiles = value.length + newFiles.length;
    if (totalFiles > maxFiles) {
      alert(`Solo puedes subir un máximo de ${maxFiles} archivos.`);
      const allowed = newFiles.slice(0, maxFiles - value.length);
      if (allowed.length > 0) {
        onChange([...value, ...allowed]);
      }
    } else {
      onChange([...value, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-[1.01]' 
            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
          }
          p-8 cursor-pointer flex flex-col items-center justify-center min-h-[120px] group
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple
          onChange={handleChange}
        />

        <div className="flex flex-col items-center text-center">
          <div className={`p-3 rounded-full bg-gray-100 mb-3 group-hover:bg-primary/10 transition-colors`}>
            <Upload className={`w-6 h-6 text-gray-400 group-hover:text-primary transition-colors`} />
          </div>
          <p className="text-sm font-medium text-gray-900">
            <span className="text-primary">Haz clic para subir</span> o arrastra y suelta
          </p>
          <p className="text-xs text-gray-500 mt-1">{helperText}</p>
          <p className="text-xs text-gray-400 mt-2">Máximo {maxFiles} archivos</p>
        </div>
      </div>
      
      {value.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
              {value.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 shadow-sm animate-in fade-in zoom-in duration-200">
                      {file.type.startsWith('image/') ? (
                          <ImageIcon size={14} className="text-blue-500" />
                      ) : (
                          <FileText size={14} className="text-gray-500" />
                      )}
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="text-gray-400 hover:text-red-500 ml-1 p-0.5 rounded-full hover:bg-red-50 transition-colors"
                      >
                          <X size={14} />
                      </button>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}
