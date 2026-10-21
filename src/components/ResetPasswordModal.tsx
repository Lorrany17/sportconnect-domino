"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

export default function ResetPasswordModal() {
  const { updatePassword, user } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Por favor, preencha todos os campos.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("As senhas não coincidem. Verifique e tente novamente.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setErrorMessage(error.message || "Erro ao atualizar a senha. Tente novamente.");
      } else {
        setSuccessMessage("Senha alterada com sucesso! Redirecionando...");
        setTimeout(() => {
          router.push("/hub");
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar a senha.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none animate-fadeIn">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-[#00a2ff]/10 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-blue-600/5 blur-3xl -z-10" />

      {/* Card do Formulário */}
      <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative overflow-hidden text-[#e4e4e7]">
        {/* Faixa decorativa superior em gradiente azul SportConnect */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] via-blue-500 to-indigo-500" />

        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-6">
          <Image
            src="/logo.png"
            alt="SportConnect Logo"
            width={150}
            height={38}
            priority
            className="h-9 w-auto object-contain mb-4"
          />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00a2ff]/10 border border-[#00a2ff]/20 text-[#00a2ff] text-xs font-black uppercase tracking-wider mb-2">
            <KeyRound className="h-3.5 w-3.5" />
            <span>Recuperação de Acesso</span>
          </div>
          <h2 className="font-display font-black text-white text-xl tracking-wide uppercase">
            Criar Nova Senha
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {user?.email
              ? `Defina uma nova senha para a conta ${user.email}`
              : "Defina sua nova senha de acesso para continuar no SportConnect"}
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo Nova Senha */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
              Nova Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage("");
                  if (successMessage) setSuccessMessage("");
                }}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-11 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title={showNewPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Campo Confirmar Nova Senha */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage("");
                  if (successMessage) setSuccessMessage("");
                }}
                placeholder="Repita a nova senha"
                className="w-full pl-10 pr-11 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mensagem de Erro com cor vermelha e fonte pequena */}
          {errorMessage && (
            <p className="text-red-500 text-sm text-center font-medium animate-fadeIn">
              {errorMessage}
            </p>
          )}

          {/* Mensagem de Sucesso Verde */}
          {successMessage && (
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-sm font-medium animate-fadeIn text-center">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-3 py-3.5 px-4 rounded-xl bg-[#00a2ff] hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Salvando Senha...</span>
              </>
            ) : (
              <span>Salvar Senha</span>
            )}
          </button>
        </form>
      </div>

      <footer className="mt-8 text-center text-[10px] text-zinc-600 uppercase tracking-widest">
        SportConnect • Segurança de Acesso
      </footer>
    </div>
  );
}
