'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, FileText } from 'lucide-react';

interface FileUploadProps {
  label?: string;
  onChange: (file: File | null) => void;
  value?: File | null;
  currentImageUrl?: string | null;
  accept?: string;
  className?: string;
  helperText?: string;
}

export default function FileUpload({
  label,
  onChange,
  value,
  currentImageUrl,
  accept = "image/*",
  className = "",
  helperText = "Arrastra y suelta o haz clic para seleccionar"
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update preview when value changes
  if (value && !preview) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(value);
  } else if (!value && preview) {
    setPreview(null);
  }

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      onChange(file);
      
      // Create preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onChange(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const displayImage = preview || currentImageUrl;

  return (
    <div className={`w-full ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-[1.01]' 
            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
          }
          ${displayImage ? 'p-4' : 'p-8'}
          cursor-pointer flex flex-col items-center justify-center min-h-[160px] group
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
          onChange={handleChange}
        />

        {displayImage ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative group/image flex flex-col items-center">
                {/* Check if it's a PDF */}
                {(displayImage.toLowerCase().endsWith('.pdf') || (value && value.type === 'application/pdf')) ? (
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <FileText size={48} className="text-red-500 mb-2" />
                        <span className="text-sm font-medium text-gray-600">Documento PDF</span>
                    </div>
                ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                        src={displayImage} 
                        alt="Preview" 
                        className="max-h-48 rounded-lg shadow-sm object-contain" 
                    />
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <p className="text-white text-sm font-medium">Cambiar archivo</p>
                </div>
            </div>
            
            {value && (
                <button
                onClick={handleRemove}
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 shadow-md transition-colors z-10"
                title="Eliminar selección"
                >
                <X size={14} />
                </button>
            )}
            
            {!value && currentImageUrl && (
                 <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-medium text-gray-500 shadow-sm pointer-events-none">
                    Actual
                 </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className={`p-4 rounded-full bg-gray-100 mb-4 group-hover:bg-primary/10 transition-colors`}>
              <Upload className={`w-8 h-8 text-gray-400 group-hover:text-primary transition-colors`} />
            </div>
            <p className="text-sm font-medium text-gray-900">
              <span className="text-primary">Haz clic para subir</span> o arrastra y suelta
            </p>
            <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            <p className="text-xs text-gray-400 mt-2">SVG, PNG, JPG o GIF</p>
          </div>
        )}
      </div>
      
      {value && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
              <FileText size={14} className="text-primary" />
              <span className="truncate max-w-[200px]">{value.name}</span>
              <span className="text-gray-400">({(value.size / 1024).toFixed(0)} KB)</span>
          </div>
      )}
    </div>
  );
}
