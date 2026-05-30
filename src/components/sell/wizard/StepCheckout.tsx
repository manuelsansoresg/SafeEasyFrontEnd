'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchWithAuth } from '@/lib/api';
import { subscriptionsService } from '@/services/subscriptionsService';
import type { Plan } from '@/types/subscriptions';
import { normalizePlanFeatures } from '@/components/sell/planText';
import { Check, CreditCard, Eye, EyeOff, LockKeyhole, ReceiptText, ShieldCheck } from 'lucide-react';

type CheckoutPlan = {
  id: number;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
};

type FormState = {
  name: string;
  lastName: string;
  secondLastName: string;
  email: string;
  companyName: string;
  password: string;
  confirmPassword: string;
};

const fallbackPlans: Record<string, CheckoutPlan> = {
  estandar: {
    id: 1,
    name: 'Estándar',
    price: 3600,
    period: 'año',
    description: 'Ideal para negocios establecidos.',
    features: ['Hasta 500 productos', 'Perfil verificado', 'Soporte por correo'],
  },
  profesional: {
    id: 2,
    name: 'Profesional',
    price: 4600,
    period: 'año',
    description: 'Para maximizar sus ventas.',
    features: ['Productos ilimitados', 'Prioridad en búsquedas', 'Soporte prioritario'],
  },
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const buildSupplierSlug = (value: string) => {
  const slug = normalize(value)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'empresa';
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

const getMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'No pudimos iniciar el pago. Inténtelo nuevamente.';
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const extractBackendMessage = (body: unknown): string | null => {
  if (!body) return null;
  if (typeof body === 'string') return body;
  if (Array.isArray(body)) {
    return body
      .map((item) => extractBackendMessage(item))
      .filter(Boolean)
      .join(', ') || null;
  }
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.error;
    if (Array.isArray(detail)) return extractBackendMessage(detail);
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object') return extractBackendMessage(detail);
  }
  return null;
};

const translateBackendMessage = (message: string | null, fallback: string) => {
  const normalized = String(message || '').trim();
  if (!normalized) return fallback;
  const lower = normalized.toLowerCase();

  if (lower.includes('internal server error')) {
    return `${fallback} El servidor respondió con un error interno. Puede deberse a una validación o configuración del backend; intenta de nuevo y, si continúa, revisa los logs del servidor.`;
  }
  if (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique')) {
    return 'Ese correo ya está registrado. Inicia sesión o usa otro correo para crear la cuenta.';
  }
  if (lower.includes('field required')) {
    return 'Faltan datos obligatorios. Revisa el formulario e intenta nuevamente.';
  }
  if (lower.includes('value is not a valid') || lower.includes('enum')) {
    return 'Uno de los datos enviados no coincide con lo que espera el servidor. Revisa el rol del usuario o el plan seleccionado.';
  }
  if (lower.includes('supplier not found')) {
    return 'La cuenta se creó, pero todavía no tiene un perfil de proveedor asociado para activar el pago.';
  }
  if (lower.includes('plan not found')) {
    return 'No encontramos el plan seleccionado en el servidor. Revisa que el plan exista y esté activo.';
  }
  if (lower.includes('plan is not active')) {
    return 'El plan seleccionado no está activo. Elige otro plan o actívalo desde administración.';
  }
  if (lower.includes('only suppliers')) {
    return 'La cuenta debe ser de proveedor para poder comprar una suscripción.';
  }

  return normalized;
};

const buildRequestError = async (response: Response, fallback: string) => {
  const body = await readResponseBody(response);
  const backendMessage = extractBackendMessage(body);
  return translateBackendMessage(backendMessage, fallback);
};

const buildSupplierFormData = (userId: number, companyName: string, email: string) => {
  const data = new FormData();
  const append = (key: string, value: string) => {
    data.append(key, value ? value.trim() : '');
  };

  append('name', companyName);
  data.append('short_name', buildSupplierSlug(companyName));
  append('rfc', '');
  append('phone', '');
  append('email', email);
  append('city', '');
  append('state', '');
  append('country', 'Mexico');
  append('short_description', '');
  append('description', '');
  append('address', '');
  append('exterior_number', '');
  append('interior_number', '');
  append('neighborhood', '');
  append('zip_code', '');
  append('cp', '');
  append('cross_street_1', '');
  append('cross_street_2', '');
  append('about', '');
  data.append('user_id', String(userId));
  data.append('is_active', 'true');
  data.append('transfer_accepted', 'false');

  return data;
};

const pickPlanArray = (data: unknown): Plan[] => {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.plans;
    if (Array.isArray(items)) return items as Plan[];
  }
  return [];
};

interface StepCheckoutProps {
  selectedPlan: string;
}

export default function StepCheckout({ selectedPlan }: StepCheckoutProps) {
  const { login } = useAuthStore();
  const selectedKey = normalize(selectedPlan || 'estandar');
  const fallbackPlan = fallbackPlans[selectedKey] ?? fallbackPlans.estandar;
  const [serverPlans, setServerPlans] = useState<Plan[]>([]);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    lastName: '',
    secondLastName: '',
    email: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/plans/?skip=0&limit=1000&only_active=true')
      .then((response) => (response.ok ? response.json() : []))
      .then((plans: unknown) => {
        if (!mounted) return;
        setServerPlans(pickPlanArray(plans));
      })
      .catch(() => {
        if (mounted) setServerPlans([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const plan = useMemo<CheckoutPlan>(() => {
    const matched = serverPlans.find((item) => normalize(item.title).includes(selectedKey));
    if (!matched) return fallbackPlan;
    const featureLines = normalizePlanFeatures(matched.features, matched.description);

    return {
      ...fallbackPlan,
      id: matched.id,
      name: matched.title || fallbackPlan.name,
      price: matched.price,
      period: matched.duration === 'monthly' ? 'mes' : 'año',
      description: matched.description || fallbackPlan.description,
      features: featureLines.length > 0 ? featureLines : fallbackPlan.features,
    };
  }, [fallbackPlan, selectedKey, serverPlans]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const userResponse = await fetch('/api/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          last_name: formData.lastName.trim(),
          second_last_name: formData.secondLastName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: 'supplier',
          is_active: true,
        }),
      });

      const userBody = await readResponseBody(userResponse) as {
        id?: number;
        name?: string;
        full_name?: string;
        email?: string;
        role?: string;
        detail?: string;
      } | null;

      if (!userResponse.ok || !userBody?.id) {
        throw new Error(translateBackendMessage(extractBackendMessage(userBody), 'No pudimos crear la cuenta de usuario.'));
      }

      const loginBody = new URLSearchParams();
      loginBody.append('username', formData.email);
      loginBody.append('password', formData.password);

      const loginResponse = await fetch('/api/login/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginBody.toString(),
      });

      if (!loginResponse.ok) {
        throw new Error(await buildRequestError(loginResponse, 'Cuenta creada, pero no pudimos iniciar sesión para continuar con el pago.'));
      }

      const loginData = await loginResponse.json() as {
        access_token?: string;
        refresh_token?: string | null;
      };

      if (!loginData.access_token) {
        throw new Error('No recibimos un token válido para iniciar el pago.');
      }

      login(loginData.access_token, loginData.refresh_token || null, {
        id: userBody.id,
        name: userBody.name || userBody.full_name || formData.name,
        email: userBody.email || formData.email.trim(),
        role: 'supplier',
      });

      const supplierResponse = await fetchWithAuth('/api/suppliers/', {
        method: 'POST',
        body: buildSupplierFormData(userBody.id, formData.companyName, formData.email.trim()),
      });

      if (!supplierResponse.ok) {
        const supplierBody = await readResponseBody(supplierResponse);
        throw new Error(translateBackendMessage(extractBackendMessage(supplierBody), 'Cuenta creada, pero no pudimos registrar tu empresa.'));
      }

      let purchase;
      try {
        purchase = await subscriptionsService.purchase(plan.id);
      } catch (purchaseError) {
        throw new Error(translateBackendMessage(getMessage(purchaseError), 'No pudimos crear la ficha de pago. La cuenta fue creada pero el pago no se pudo iniciar. Contactá soporte si el problema persiste.'));
      }
      window.location.href = purchase.init_point;
    } catch (submitError) {
      setError(getMessage(submitError));
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="h-full rounded-lg border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-28">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f2f3f4] text-primary">
            <ReceiptText size={22} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Plan elegido</p>
            <h2 className="text-2xl font-bold text-gray-950">{plan.name}</h2>
          </div>
        </div>

        <div className="rounded-lg bg-[#f2f3f4] p-5">
          <p className="text-sm text-gray-500">Total a pagar</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-primary">{formatCurrency(plan.price)}</span>
            <span className="pb-1 text-sm text-gray-500">/{plan.period}</span>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-4 text-sm font-semibold text-gray-700">Incluye tu plan</p>
          <ul className="space-y-3">
          {plan.features.map((feature, featureIndex) => (
            <li key={`${feature}-${featureIndex}`} className="flex items-center gap-3 text-sm text-gray-600">
              <Check className="shrink-0 text-secondary" size={18} />
              {feature}
            </li>
          ))}
          </ul>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-gray-100 p-4 text-sm leading-6 text-gray-500">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} />
          El pago se completa de forma segura en Mercado Pago.
        </div>
      </aside>

      <section className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-8">
          <p className="font-[family-name:var(--font-varela-round)] text-lg text-secondary">Registro de usuario</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-950">Crea tu cuenta y paga tu plan</h2>
          <p className="mt-3 text-sm leading-7 text-gray-500">
            Primero creamos tu usuario. Después podrás personalizar los datos de tu empresa desde tu panel.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Nombre</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="h-12 w-full rounded-lg border border-gray-200 px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="Juan"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Apellido paterno</label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="Pérez"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Apellido materno</label>
              <input
                type="text"
                name="secondLastName"
                required
                value={formData.secondLastName}
                onChange={handleChange}
                className="h-12 w-full rounded-lg border border-gray-200 px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="López"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Correo electrónico</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="h-12 w-full rounded-lg border border-gray-200 px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="juan@empresa.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Nombre de la empresa</label>
            <input
              type="text"
              name="companyName"
              required
              maxLength={255}
              value={formData.companyName}
              onChange={handleChange}
              className="h-12 w-full rounded-lg border border-gray-200 px-4 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="Mi Negocio S.A."
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  className="h-12 w-full rounded-lg border border-gray-200 px-4 pr-11 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Confirmar contraseña</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  minLength={8}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="h-12 w-full rounded-lg border border-gray-200 px-4 pr-11 text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Repite tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-[#f2f3f4] p-4 text-sm leading-6 text-gray-600">
            <LockKeyhole className="mt-0.5 shrink-0 text-primary" size={18} />
            Este paso solo crea tu usuario. La información de tu empresa se completa después desde el panel.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 font-bold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CreditCard size={20} />
            {loading ? 'Preparando pago...' : 'Pagar'}
          </button>
        </form>
      </section>
    </div>
  );
}
