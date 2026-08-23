"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { confirmPasswordReset } from "@/services/passwordResetService";

const MAX_PASSWORD_BYTES = 72;

const formSchema = z
  .object({
    password: z.string().min(1, "La contraseña es obligatoria."),
    confirmPassword: z.string().min(1, "Confirma tu contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

function validatePassword(value: string): string | null {
  if (value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (value.length > 128) return "La contraseña es demasiado larga.";
  const byteLength = new TextEncoder().encode(value).length;
  if (byteLength > MAX_PASSWORD_BYTES) return "La contraseña es demasiado larga.";
  return null;
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
    }
  }, [token]);

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setInvalidToken(true);
      return;
    }

    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues | undefined;
        if (field) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    const passwordError = validatePassword(parsed.data.password);
    if (passwordError) {
      setError("password", { message: passwordError });
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      await confirmPasswordReset(token, parsed.data.password);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login?passwordReset=success");
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "rate_limit") {
        setGeneralError(
          "Has realizado demasiados intentos. Espera un momento antes de volver a intentarlo.",
        );
      } else if (
        message === "network_error" ||
        (!message.startsWith("Error ") && !message)
      ) {
        setGeneralError(
          "No pudimos procesar tu solicitud en este momento. Inténtalo nuevamente.",
        );
      } else {
        setInvalidToken(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Contraseña restablecida
          </h1>
          <p className="text-sm text-gray-600">
            Tu contraseña fue restablecida correctamente. Redirigiendo al inicio
            de sesión...
          </p>
        </div>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-50 p-4">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Este enlace de recuperación no es válido o ha expirado.
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Por seguridad, los enlaces para restablecer tu contraseña tienen una
            vigencia limitada.
          </p>
          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Solicitar un nuevo enlace
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full text-sm text-primary hover:text-primary/80 font-medium"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-50 p-4">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            El enlace de recuperación no es válido.
          </h1>
          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Solicitar un nuevo enlace
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full text-sm text-primary hover:text-primary/80 font-medium"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Nueva contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tu nueva contraseña para acceder a tu cuenta.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.confirmPassword ? "true" : undefined}
                aria-describedby={
                  errors.confirmPassword ? "confirm-password-error" : undefined
                }
                {...register("confirmPassword")}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {generalError && (
            <div
              className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle size={16} className="shrink-0" />
              {generalError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Restableciendo...
                </>
              ) : (
                "Restablecer contraseña"
              )}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
