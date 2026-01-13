'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

interface StepAccountProps {
  plan: string;
  onSuccess: (userId: number, token: string) => void;
}

export default function StepAccount({ plan, onSuccess }: StepAccountProps) {
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      // 1. Create User
      const userPayload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'supplier',
        is_active: true,
      };

      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      if (!userRes.ok) {
        const errData = await userRes.json();
        throw new Error(errData.detail || 'Error al crear la cuenta');
      }

      // 2. Login to get Token
      const loginBody = new URLSearchParams();
      loginBody.append('username', formData.email);
      loginBody.append('password', formData.password);

      const loginRes = await fetch('/api/login/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginBody.toString(),
      });

      if (!loginRes.ok) {
        throw new Error('Cuenta creada, pero error al iniciar sesión. Intente ingresar manualmente.');
      }

      const loginData = await loginRes.json();
      const token = loginData.access_token;
      const refreshToken = loginData.refresh_token || null;
      
      // We might need to fetch 'me' to get the ID, or maybe the login response has it?
      // Assuming we need to fetch user info or use what we have. 
      // Usually login returns access_token. We need user ID for the next steps.
      // Let's assume we can fetch /api/users/me or similar, or maybe the create response had the ID?
      
      // Let's try to get the user ID from the create response first if possible.
      // But usually create response has the object.
      const userData = await userRes.json().catch(() => ({})); 
      // Wait, I already read userRes.json() in error handling? No, only if !ok.
      // I can't read it again if I didn't clone it?
      // Actually, standard fetch allows reading body only once.
      // I should have read it once.
      
      // Let's refactor to read once.
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return;
    }
  };

  // Refactored handleSubmit
  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      // 1. Create User
      const userPayload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'supplier',
        is_active: true,
      };

      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      let createdUser = null;
      if (userRes.ok) {
          createdUser = await userRes.json();
      } else {
          const errData = await userRes.json();
          throw new Error(errData.detail || 'Error al crear la cuenta. Verifique que el correo no esté registrado.');
      }

      // 2. Login
      const loginBody = new URLSearchParams();
      loginBody.append('username', formData.email);
      loginBody.append('password', formData.password);

      const loginRes = await fetch('/api/login/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: loginBody.toString(),
      });

      if (!loginRes.ok) {
        throw new Error('Error de autenticación');
      }

      const loginData = await loginRes.json();
      
      // Update Store
      // We need to construct the user object for the store
      const userForStore = {
          id: createdUser.id,
          name: createdUser.name || createdUser.full_name || formData.name,
          email: createdUser.email,
          role: createdUser.role
      };
      
      login(loginData.access_token, loginData.refresh_token, userForStore);
      
      onSuccess(createdUser.id, loginData.access_token);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-2">Crea tu cuenta</h2>
      <p className="text-center text-gray-500 mb-6">
        Plan seleccionado: <span className="font-semibold text-primary capitalize">{plan}</span>
      </p>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmitFinal} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="Juan Pérez"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="juan@empresa.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 mt-6"
        >
          {loading ? 'Registrando...' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
