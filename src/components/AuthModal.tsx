"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  LogIn,
  UserPlus,
  Phone,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { formatPhoneBR } from "@/app/perfil/page";

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultTab?: "login" | "signup";
  onSuccess?: () => void;
  embedded?: boolean; // Se verdadeiro, renderiza inline sem overlay modal fixo
}

export default function AuthModal({
  isOpen = true,
  onClose,
  defaultTab = "login",
  onSuccess,
  embedded = false,
}: AuthModalProps) {
  const { signIn, signUp, resetPassword } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup">(defaultTab);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  // Tradução e mapeamento amigável de erros do Supabase Auth
  const mapAuthError = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
      return "E-mail ou senha incorretos. Tente novamente.";
    }
    if (lower.includes("user already registered") || lower.includes("already registered")) {
      return "Este e-mail já está cadastrado. Alterne para a aba 'Entrar' para fazer login.";
    }
    if (lower.includes("password should be at least 6")) {
      return "A senha deve conter no mínimo 6 caracteres.";
    }
    if (lower.includes("email not confirmed")) {
      return "E-mail ainda não confirmado. Por favor, verifique sua caixa de entrada para ativar a conta.";
    }
    if (lower.includes("rate limit") || lower.includes("too many requests")) {
      return "Muitas tentativas consecutivas. Aguarde alguns instantes antes de tentar novamente.";
    }
    if (lower.includes("invalid email")) {
      return "Por favor, informe um endereço de e-mail válido.";
    }
    return message || "Ocorreu um erro na autenticação. Tente novamente.";
  };

  const handleTabChange = (tab: "login" | "signup") => {
    setActiveTab(tab);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleForgotPassword = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Por favor, preencha seu e-mail acima para recuperar a senha.");
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await resetPassword(trimmedEmail);
      if (error) {
        setErrorMessage(mapAuthError(error.message));
      } else {
        setSuccessMessage("Instruções de recuperação enviadas para o seu e-mail!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.";
      setErrorMessage(mapAuthError(msg));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validações básicas no cliente
    if (!email.trim() || !password) {
      setErrorMessage("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (activeTab === "signup") {
      if (!fullName.trim()) {
        setErrorMessage("Por favor, preencha seu Nome Completo.");
        return;
      }

      const phoneDigits = phone.replace(/\D/g, "");
      if (!phone.trim()) {
        setErrorMessage("Por favor, preencha seu Telefone / WhatsApp.");
        return;
      }
      if (phoneDigits.length < 10) {
        setErrorMessage("Por favor, informe um Telefone / WhatsApp válido com DDD.");
        return;
      }
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve conter pelo menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (activeTab === "signup") {
        // Envia options.data.full_name e phone para alimentar o Trigger da tabela profiles
        const { data, error } = await signUp(
          email.trim(),
          password,
          fullName.trim(),
          phone.trim()
        );

        if (error) {
          setErrorMessage(mapAuthError(error.message));
        } else {
          if (data?.session) {
            setSuccessMessage("Conta criada e autenticada com sucesso! Redirecionando...");
            setTimeout(() => {
              onSuccess?.();
              onClose?.();
            }, 1200);
          } else {
            setSuccessMessage(
              "Cadastro realizado! Verifique seu e-mail caso seja necessária a confirmação para entrar."
            );
          }
        }
      } else {
        // Login com e-mail e senha
        const { error } = await signIn(email.trim(), password);

        if (error) {
          setErrorMessage(mapAuthError(error.message));
        } else {
          setSuccessMessage("Login efetuado com sucesso! Bem-vindo de volta.");
          setTimeout(() => {
            onSuccess?.();
            onClose?.();
          }, 1000);
        }
      }
    } catch (err: unknown) {
      console.error("Erro na autenticação:", err);
      const msg = err instanceof Error ? err.message : "Falha na conexão com o serviço de autenticação.";
      setErrorMessage(mapAuthError(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative overflow-hidden text-[#e4e4e7] animate-fadeIn">
      {/* Faixa decorativa superior em gradiente azul SportConnect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] via-blue-500 to-indigo-500" />

      {/* Botão de Fechar Modal (se onClose estiver disponível) */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Cabeçalho do Modal */}
      <div className="flex flex-col items-center text-center mb-6">
        <Image
          src="/logo.png"
          alt="SportConnect Logo"
          width={150}
          height={38}
          priority
          className="h-9 w-auto object-contain mb-4"
        />
        <h2 className="font-display font-black text-white text-lg tracking-wide uppercase">
          {activeTab === "login" ? "Acessar Plataforma" : "Criar Nova Conta"}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          {activeTab === "login"
            ? "Entre com suas credenciais do SportConnect para gerenciar torneios"
            : "Cadastre-se para organizar campeonatos e acompanhar súmulas"}
        </p>
      </div>

      {/* Seletor de Abas (Tabs: Entrar / Criar Conta) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0f0f0f] border border-[#27272a] rounded-xl mb-6">
        <button
          type="button"
          onClick={() => handleTabChange("login")}
          className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "login"
              ? "bg-[#00a2ff] text-white shadow-md shadow-blue-500/25"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <LogIn className="h-3.5 w-3.5" />
          <span>Entrar</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("signup")}
          className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "signup"
              ? "bg-[#00a2ff] text-white shadow-md shadow-blue-500/25"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Criar Conta</span>
        </button>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo Nome Completo (Apenas na aba de Cadastro) */}
        {activeTab === "signup" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
              Nome Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errorMessage) setErrorMessage("");
                  if (successMessage) setSuccessMessage("");
                }}
                placeholder="Ex: Carlos Eduardo Silva"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Campo Telefone / WhatsApp (Apenas na aba de Cadastro) */}
        {activeTab === "signup" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
              Telefone / WhatsApp <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Phone className="h-4 w-4" />
              </div>
              <input
                type="tel"
                required={true}
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhoneBR(e.target.value));
                  if (errorMessage) setErrorMessage("");
                  if (successMessage) setSuccessMessage("");
                }}
                placeholder="(XX) XXXXX-XXXX"
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Campo E-mail */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
            E-mail
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage("");
                if (successMessage) setSuccessMessage("");
              }}
              placeholder="seu@email.com"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Campo Senha */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block pl-1">
            Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
                if (successMessage) setSuccessMessage("");
              }}
              placeholder={activeTab === "signup" ? "Mínimo 6 caracteres" : "Sua senha de acesso"}
              className="w-full pl-10 pr-11 py-3 bg-zinc-900 border border-zinc-800 focus:border-[#00a2ff] focus:ring-1 focus:ring-[#00a2ff] rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={showPassword ? "Ocultar senha" : "Exibir senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Botão "Esqueci a senha" (Apenas na aba de Login) */}
          {activeTab === "login" && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs text-zinc-400 hover:text-blue-500 transition-colors bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? "Enviando..." : "Esqueci minha senha"}
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de Erro com cor vermelha e fonte pequena */}
        {errorMessage && (
          <p className="text-red-500 text-sm text-center font-medium animate-fadeIn">
            {errorMessage}
          </p>
        )}

        {/* Mensagem de Sucesso Verde */}
        {successMessage && (
          <p className="text-emerald-400 text-sm text-center font-medium animate-fadeIn">
            {successMessage}
          </p>
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
              <span>Processando...</span>
            </>
          ) : activeTab === "login" ? (
            <>
              <LogIn className="h-4 w-4" />
              <span>Entrar no Sistema</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span>Concluir Cadastro</span>
            </>
          )}
        </button>
      </form>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      {content}
    </div>
  );
}
