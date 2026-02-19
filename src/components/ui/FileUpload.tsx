'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, FileText, Video } from 'lucide-react';

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
  const [inlineError, setInlineError] = useState(false);
  const [hasClearedExisting, setHasClearedExisting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllowedFile = (file: File) => {
    if (!accept) return true;
    const patterns = accept.split(',').map((p) => p.trim());
    const mime = file.type;
    const name = file.name.toLowerCase();

    const allowed = patterns.some((pattern) => {
      if (pattern === 'image/*') return mime.startsWith('image/');
      if (pattern === 'video/*') return mime.startsWith('video/');
      if (pattern.startsWith('video/')) return mime === pattern;
      if (pattern === 'application/pdf') return mime === 'application/pdf';
      return true;
    });

    if (!allowed) {
      let message = 'Archivo no permitido.';
      if (accept.includes('video') || patterns.some(p => p.startsWith('video/'))) {
        message = 'Solo se permiten videos (por ejemplo MP4, WEBM o MOV).';
      } else if (accept.includes('image/*')) {
        message = 'Solo se permiten archivos de imagen.';
      }
      alert(message);
    }
    return allowed;
  };

  useEffect(() => {
    setHasClearedExisting(false);
  }, [currentImageUrl]);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        alert('Solo se permite adjuntar un archivo.');
      }
      const file = e.dataTransfer.files[0];
      if (!isAllowedFile(file)) return;

      onChange(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 1) {
        alert('Solo se permite adjuntar un archivo.');
      }
      const file = e.target.files[0];
      if (!isAllowedFile(file)) {
        e.target.value = '';
        return;
      }

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
    setHasClearedExisting(true);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };
  
  const effectiveCurrentUrl = hasClearedExisting ? null : currentImageUrl || null;
  const displayImage = preview || effectiveCurrentUrl || null;

  const lowerDisplay = preview ? preview.toLowerCase() : (effectiveCurrentUrl ? effectiveCurrentUrl.toLowerCase() : '');
  const isPdf =
    lowerDisplay.endsWith('.pdf') ||
    (value && value.type === 'application/pdf');
  const isVideo =
    (value && value.type.startsWith('video/')) ||
    /\.(mp4|webm|ogg)$/i.test(lowerDisplay);
  const acceptsVideo = !!accept && accept.includes('video');

  const getFileNameFromUrl = (url: string) => {
    try {
      const withoutQuery = url.split(/[?#]/)[0];
      const lastSegment = withoutQuery.split('/').pop() || '';
      return decodeURIComponent(lastSegment) || 'archivo';
    } catch {
      return 'archivo';
    }
  };

  const effectiveFileName = value?.name || (effectiveCurrentUrl ? getFileNameFromUrl(effectiveCurrentUrl) : null);

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
            {value ? (
              <div className="relative group/image flex flex-col items-center">
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <FileText size={48} className="text-red-500 mb-2" />
                    <span className="text-sm font-medium text-gray-600">Documento PDF</span>
                  </div>
                ) : isVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={displayImage || undefined}
                    className="max-h-48 rounded-lg shadow-sm object-contain"
                    controls
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImage || undefined}
                    alt="Preview"
                    className="max-h-48 rounded-lg shadow-sm object-contain"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <p className="text-white text-sm font-medium">Cambiar archivo</p>
                </div>
              </div>
            ) : effectiveCurrentUrl ? (
              <>
                {!inlineError && acceptsVideo ? (
                  <div className="relative w-full flex items-center justify-center">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={effectiveCurrentUrl}
                      className="max-h-48 rounded-lg shadow-sm object-contain"
                      controls
                      onError={() => setInlineError(true)}
                      crossOrigin="anonymous"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    {acceptsVideo ? (
                      <Video size={40} className="text-primary" />
                    ) : (
                      <ImageIcon size={40} className="text-primary" />
                    )}
                    <div className="text-xs text-gray-600">
                      <div className="font-medium">Archivo actual</div>
                      {effectiveFileName && (
                        <div className="max-w-[260px] mx-auto truncate" title={effectiveFileName}>
                          {effectiveFileName}
                        </div>
                      )}
                      {acceptsVideo && inlineError && (
                        <div className="text-[11px] text-gray-400 mt-1">
                          No se pudo reproducir aquí. Usa “Ver archivo”.
                        </div>
                      )}
                    </div>
                    <a
                      href={effectiveCurrentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Ver archivo
                    </a>
                  </div>
                )}
              </>
            ) : null}
            
            {(value || effectiveCurrentUrl) && (
              <button
                onClick={handleRemove}
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 shadow-md transition-colors z-10"
                title="Eliminar selección"
              >
                <X size={14} />
              </button>
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
            <p className="text-xs text-gray-400 mt-2">
              Imágenes o videos (según configuración)
            </p>
          </div>
        )}
      </div>
      
      {(value || effectiveCurrentUrl) && effectiveFileName && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
          {isVideo || (!value && acceptsVideo) ? (
            <Video size={14} className="text-primary" />
          ) : isPdf ? (
            <FileText size={14} className="text-primary" />
          ) : (
            <ImageIcon size={14} className="text-primary" />
          )}
          <span className="truncate max-w-[200px]" title={effectiveFileName}>
            {effectiveFileName}
          </span>
          {value && (
            <span className="text-gray-400">({(value.size / 1024).toFixed(0)} KB)</span>
          )}
        </div>
      )}
    </div>
  );
}
