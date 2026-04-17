"use client";

import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";
import { Facebook } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";

export interface SocialLoginPayload {
  provider: "google" | "facebook";
  token: string;
  email?: string;
  name?: string;
  avatar?: string;
  social_id?: string;
}

interface SocialLoginButtonsProps {
  facebookClientId: string;
  onSocialLogin: (payload: SocialLoginPayload) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6.1-2.8-6.1-6.2s2.8-6.2 6.1-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 2.9 14.7 2 12 2 6.9 2 2.8 6.2 2.8 11.4S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.8 7.3l3.2 2.4c.9-2.1 2.8-3.6 5-3.6 1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 2.9 14.7 2 12 2 8.5 2 5.4 4.1 3.8 7.3z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.8c2.6 0 4.8-.8 6.4-2.3l-3-2.4c-.8.6-2 .9-3.4.9-3.9 0-5.2-2.6-5.5-3.8l-3.3 2.6c1.6 3.2 4.8 5 8.8 5z"
      />
      <path
        fill="#FBBC05"
        d="M3.8 15.8l3.3-2.6c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3.8 7.3c-.7 1.4-1 2.6-1 4.1s.3 2.7 1 4.4z"
      />
    </svg>
  );
}

const buttonClassName =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 flex justify-center items-center gap-3 transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

export default function SocialLoginButtons({
  facebookClientId,
  onSocialLogin,
  onError,
  disabled = false,
}: SocialLoginButtonsProps) {
  const handleGoogleLogin = useGoogleLogin({
    scope: "openid profile email",
    onSuccess: async (tokenResponse) => {
      try {
        const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!profileResponse.ok) {
          throw new Error("No se pudo obtener el perfil de Google");
        }

        const profile = await profileResponse.json();

        onSocialLogin({
          provider: "google",
          token: tokenResponse.access_token,
          email: profile.email,
          name: profile.name,
          avatar: profile.picture,
          social_id: profile.sub,
        });
      } catch (error) {
        console.error("Google login error", error);
        onError("Falló el inicio de sesión con Google");
      }
    },
    onError: () => {
      onError("Falló el inicio de sesión con Google");
    },
  });

  const handleFacebookResponse = (response: any) => {
    if (response.accessToken) {
      onSocialLogin({
        provider: "facebook",
        token: response.accessToken,
        email: response.email,
        name: response.name,
        avatar: response.picture?.data?.url,
        social_id: response.userID,
      });
      return;
    }

    if (response.status !== "unknown") {
      console.error("Facebook login error", response);
      onError("Error al conectar con Facebook");
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 gap-3">
      <button type="button" onClick={() => handleGoogleLogin()} className={buttonClassName} disabled={disabled}>
        <GoogleIcon />
        <span>Acceder con Google</span>
      </button>

      <FacebookLogin
        appId={facebookClientId}
        autoLoad={false}
        fields="name,email,picture"
        callback={handleFacebookResponse}
        render={(renderProps: any) => (
          <button
            type="button"
            onClick={renderProps.onClick}
            className={buttonClassName}
            disabled={disabled}
          >
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            <span>Acceder con Facebook</span>
          </button>
        )}
      />
    </div>
  );
}
