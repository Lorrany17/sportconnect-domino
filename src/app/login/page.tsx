"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import AuthModal from "@/components/AuthModal";
import ResetPasswordModal from "@/components/ResetPasswordModal";

export default function LoginPage() {
  const { user, isRecoveringPassword, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isRecoveringPassword && user) {
      router.push("/hub");
    }
  }, [user, loading, isRecoveringPassword, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-zinc-400 text-xs font-semibold uppercase tracking-widest">
        Carregando...
      </div>
    );
  }

  if (isRecoveringPassword) {
    return <ResetPasswordModal />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-[#00a2ff]/10 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-blue-600/5 blur-3xl -z-10" />

      {/* Fluxo principal de Autenticação Supabase (E-mail, Senha e Criar Conta) */}
      <div className="w-full max-w-md animate-fadeIn">
        <AuthModal
          embedded={true}
          onSuccess={() => router.push("/hub")}
        />
      </div>

      {/* Link de Retorno */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all font-semibold uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Voltar ao Chaveamento Público</span>
        </Link>
      </div>

      <footer className="mt-8 text-center text-[10px] text-zinc-600 uppercase tracking-widest">
        SportConnect • Tournament Engine
      </footer>
    </div>
  );
}

