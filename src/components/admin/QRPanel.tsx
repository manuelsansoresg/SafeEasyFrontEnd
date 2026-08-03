'use client';

import { useState, useEffect, useCallback } from 'react';
import { qrService } from '@/services/qrService';
import { Download, RefreshCw, QrCode, AlertCircle } from 'lucide-react';

type QRPanelProps = {
  supplierId: number;
};

export default function QRPanel({ supplierId }: QRPanelProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRImage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const imageUrl = await qrService.getQRImage(supplierId);
      setQrImageUrl(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el QR');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchQRImage();
  }, [fetchQRImage]);

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      setSuccess(null);
      await qrService.regenerateQR(supplierId);
      await fetchQRImage();
      setSuccess('Código QR regenerado exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al regenerar el QR');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!qrImageUrl) return;
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-empresa-${supplierId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Error al descargar el QR');
    }
  };

  const qrUrl = qrService.getQRUrl(supplierId);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setSuccess('Enlace copiado al portapapeles');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Error al copiar el enlace');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Código QR de tu Empresa</h3>
        <p className="text-sm text-gray-600">
          Comparte este código QR para que tus clientes accedan directamente al perfil de tu empresa.
          Al escanearlo, serán redirigidos a la página pública de tu negocio.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-100 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">{success}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-64 h-64 flex items-center justify-center bg-white rounded-lg shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : qrImageUrl ? (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <img
                src={qrImageUrl}
                alt="Código QR de la empresa"
                className="w-64 h-64"
              />
            </div>
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-400">
              <QrCode size={64} />
            </div>
          )}

          <div className="mt-6 w-full max-w-md">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-2">Enlace directo:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-gray-700 truncate bg-gray-50 px-3 py-2 rounded">
                  {qrUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="shrink-0 px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownload}
          disabled={!qrImageUrl || loading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={18} />
          Descargar PNG
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={18} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerando...' : 'Regenerar QR'}
        </button>
      </div>

      <div className="mt-8 rounded-lg bg-blue-50 border border-blue-100 p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">¿Cómo usar este QR?</h4>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            Imprime el código QR y colócalo en tu local, tarjetas o materiales promocionales
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            Compártelo en redes sociales o mensajes para que tus clientes accedan rápidamente
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            Al escanearlo, los clientes verán tu catálogo de productos y servicios
          </li>
        </ul>
      </div>
    </div>
  );
}
