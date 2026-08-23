"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Mail,
} from "lucide-react";
import { requestPasswordReset } from "@/services/passwordResetService";

const formSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El correo electrónico es obligatorio.")
    .email("Ingresa un correo electrónico válido."),
});

type FormValues = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
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

    setSubmitting(true);
    setGeneralError(null);

    try {
      await requestPasswordReset(parsed.data.email);
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "rate_limit") {
        setGeneralError(
          "Has realizado demasiadas solicitudes. Espera un momento antes de intentarlo nuevamente.",
        );
      } else if (message === "network_error") {
        setGeneralError(
          "No pudimos procesar tu solicitud en este momento. Inténtalo nuevamente.",
        );
      } else {
        setGeneralError(
          "No pudimos procesar tu solicitud en este momento. Inténtalo nuevamente.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-secondary/10 p-4">
              <Mail className="h-10 w-10 text-secondary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Revisa tu correo</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Si tu correo está registrado, recibirás un enlace para restablecer
            tu contraseña. Revisa también tu carpeta de correo no deseado.
          </p>
          <div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
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
            Recupera tu contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Ingresa el correo asociado a tu cuenta y te enviaremos un enlace
            para restablecer tu contraseña.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.email.message}
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
                  Enviando...
                </>
              ) : (
                "Enviar enlace"
              )}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-primary hover:text-primary/80 font-medium"
            >
              <ArrowLeft size={16} className="mr-1" />
              Volver a iniciar sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
