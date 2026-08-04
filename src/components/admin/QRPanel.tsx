use client;

import { useState, useCallback, useEffect } from react;
import { qrService, type QRInfo } from @/services/qrService;
import { Download, RefreshCw, QrCode, AlertCircle, Key } from lucide-react;

export default function QRPanel() {
  const [qrInfo, setQrInfo] = useState<QRInfo | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQRImage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const imageUrl = await qrService.getQRImageBlob();
      setQrImageUrl(imageUrl);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : Error al cargar el QR;
      
      // Mensaje más específico según el error
      if (errorMsg.includes(404) || errorMsg.includes(Supplier not found)) {
        setError(No se encontró tu empresa en el sistema. Verificá que tu cuenta tenga una empresa asociada en tu perfil.);
      } else if (errorMsg.includes(401) || errorMsg.includes(No autorizado)) {
        setError(Sesión expirada. Por favor, volvé a iniciar sesión.);
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerateToken = async () => {
    try {
      setGeneratingToken(true);
      setError(null);
      setQrImageUrl(null);
      const info = await qrService.generateQRToken();
      if (!info?.token) {
        setError(El servidor no devolvió un token válido. Verificá que tu empresa esté correctamente registrada.);
        return;
      }
      setQrInfo(info);
      await fetchQRImage();
      setSuccess(Token generado exitosamente. Tu código QR está listo.);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : Error al generar el token;
      if (msg.includes(404) || msg.includes(not found)) {
        setError(No se encontró tu empresa en el sistema. Verificá que tu cuenta tenga una empresa asociada en tu perfil.);
      } else {
        setError(msg);
      }
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      setSuccess(null);
      setQrImageUrl(null);
      const info = await qrService.regenerateQR();
      setQrInfo(info);
      await fetchQRImage();
      setSuccess(Código QR regenerado exitosamente);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : Error al regenerar el QR;
      if (msg.includes(404) || msg.includes(not found)) {
        setError(No se encontró tu empresa en el sistema.);
      } else {
        setError(msg);
      }
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
      const link = document.createElement(a);
      link.href = url;
      link.download = `qr-empresa.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError(Error al descargar el QR);
    }
  };

  const qrUrl = qrInfo?.token ? qrService.getQRUrl(qrInfo.token) : ;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setSuccess(Enlace copiado al portapapeles);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError(Error al copiar el enlace);
    }
  };

  const needsToken = !qrInfo?.token;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Código QR de tu Empresa</h3>
        <p className="text-sm text-gray-600">
          Genera un código QR único para que tus clientes accedan directamente al perfil de tu empresa.
          El QR apunta a un token permanente: si cambias el nombre de tu empresa, el código QR sigue funcionando.
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

      {needsToken ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Key className="mx-auto mb-4 text-amber-600" size={48} />
          <h4 className="text-lg font-semibold text-amber-900 mb-2">
            Tu empresa aún no tiene un código QR
          </h4>
          <p className="text-sm text-amber-700 mb-6 max-w-md mx-auto">
            Genera un token único para crear tu código QR. Este token es permanente:
            aunque cambies el nombre de tu empresa, el QR seguirá apuntando a tu perfil.
          </p>
          <button
            onClick={handleGenerateToken}
            disabled={generatingToken}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Key size={18} className={generatingToken ? animate-pulse : } />
            {generatingToken ? Generando token... : Generar código QR}
          </button>
        </div>
      ) : (
        <>
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
              <RefreshCw size={18} className={regenerating ? animate-spin : } />
              {regenerating ? Regenerando... : Regenerar QR}
            </button>
          </div>
        </>
      )}

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
            Al escanearlo, los clientes serán redirigidos a tu catálogo de productos y servicios
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            Si cambias el nombre de tu empresa, el QR sigue funcionando (apunta a un token único, no al nombre)
          </li>
        </ul>
      </div>
    </div>
  );
}
