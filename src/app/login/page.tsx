"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { KeyRound, ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useTournament } from "@/context/TournamentContext";

export default function LoginPage() {
  const { login, isAdmin, isAuthLoaded } = useTournament();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (isAuthLoaded && isAdmin) {
      router.push("/admin");
    }
  }, [isAdmin, isAuthLoaded, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!pin) {
      setError("Por favor, insira o PIN de acesso.");
      return;
    }

    const success = login(pin);
    if (success) {
      router.push("/admin");
    } else {
      setError("PIN inválido. Verifique o código e tente novamente.");
      setPin("");
    }
  };

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted text-sm font-semibold uppercase tracking-widest">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-brand-electric/10 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-brand-neon/5 blur-3xl -z-10" />

      {/* Main Login Card */}
      <div className="glass-panel border border-brand-border/60 rounded-2xl w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle top neon stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-electric via-brand-neon to-brand-neon-orange" />

        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/logo.png"
            alt="SportConnect Logo"
            width={160}
            height={42}
            priority
            className="h-10 w-auto object-contain mb-6"
          />
          <h2 className="font-display font-black text-white text-base tracking-widest uppercase">
            Painel do Organizador
          </h2>
          <p className="text-xs text-brand-text-muted mt-1 uppercase tracking-wider">
            Torneio de Dominó em Duplas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold p-3.5 rounded-xl animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest block pl-1">
              Senha de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-650">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Digite a Senha"
                className="w-full pl-10 pr-12 py-3 bg-neutral-950/80 border border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric/30 rounded-xl font-medium text-sm outline-none text-white transition-all placeholder-neutral-600"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                title={showPin ? "Ocultar Senha" : "Mostrar Senha"}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-brand-electric text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer hover:bg-brand-electric/90 active:scale-95 shadow-lg shadow-brand-electric/20 flex items-center justify-center gap-2"
          >
            Acessar Painel
          </button>
        </form>

        <div className="mt-8 border-t border-brand-border/40 pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-brand-text-muted hover:text-white transition-all font-semibold uppercase tracking-wider"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar ao Chaveamento Público</span>
          </Link>
        </div>
      </div>

      <footer className="mt-12 text-center text-[10px] text-neutral-700 uppercase tracking-widest">
        Torneio SportConnnect
      </footer>
    </div>
  );
}
