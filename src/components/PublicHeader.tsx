"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Compass,
  Sparkles,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { useTournament } from "@/context/TournamentContext";

interface PublicHeaderProps {
  activePage?: "explorar" | "torneio" | "chaveamento";
}

export default function PublicHeader({ activePage }: PublicHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { logout } = useTournament();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Atleta";

  const handleLogout = async () => {
    logout();
    await signOut();
    router.push("/login");
  };

  const isExplorarActive = pathname === "/explorar" || activePage === "explorar";
  const isHubActive = pathname === "/hub";

  return (
    <header className="w-full border-b border-[#27272a] bg-[#141416]/95 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Lado Esquerdo: Logotipo SportConnect */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={user ? "/hub" : "/explorar"}
            className="flex items-center gap-2 group transition-transform active:scale-95"
          >
            <Image
              src="/logo.png"
              alt="SportConnect Logo"
              width={140}
              height={36}
              priority
              className="h-8 w-auto object-contain group-hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>

        {/* Centro: Navegação Simples (Apenas Links de Texto) */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/explorar"
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              isExplorarActive
                ? "bg-[#1e1e1e] text-white border border-[#27272a] shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            <Compass className="h-4 w-4 text-[#00a2ff]" />
            <span>Explorar Torneios</span>
          </Link>

          {user && (
            <Link
              href="/hub"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isHubActive
                  ? "bg-[#1e1e1e] text-white border border-[#27272a] shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <Sparkles className="h-4 w-4 text-[#00a2ff]" />
              <span>Hub Central</span>
            </Link>
          )}
        </nav>

        {/* Lado Direito: Ações de Usuário / Menu Drop-down */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {!user ? (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00a2ff] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Entrar / Criar Conta</span>
            </Link>
          ) : (
            <div className="relative">
              {/* Botão de Trigger do Dropdown */}
              <button
                type="button"
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-2xl hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700/60 transition-all cursor-pointer group"
                title="Menu do usuário"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={userName}
                    className="w-8 h-8 rounded-xl object-cover border border-zinc-700/80 shadow-inner shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center uppercase shadow-inner shrink-0">
                    {userName.charAt(0)}
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-white group-hover:text-[#00a2ff] transition-colors truncate max-w-[120px] leading-tight">
                    {userName}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                    {user.email}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-zinc-400 group-hover:text-white transition-transform ${
                    userDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Menu Dropdown do Usuário */}
              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b] border border-zinc-800 rounded-2xl p-2 shadow-2xl z-50 animate-fadeIn space-y-1">
                    {/* Header do Menu */}
                    <div className="px-3 py-2 border-b border-zinc-800/80">
                      <p className="text-xs font-bold text-white truncate">{userName}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                    </div>

                    {/* Opção Meu Perfil */}
                    <Link
                      href="/perfil"
                      onClick={() => setUserDropdownOpen(false)}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <User className="h-4 w-4 text-[#00a2ff]" />
                      <span>Meu Perfil</span>
                    </Link>

                    {/* Atalho Super Admin: Central do Sistema */}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-purple-300 hover:text-purple-200 hover:bg-purple-600/15 border border-purple-500/25 flex items-center gap-2.5 transition-all cursor-pointer shadow-sm"
                      >
                        <ShieldCheck className="h-4 w-4 text-purple-400" />
                        <span>⚙️ Central do Sistema</span>
                      </Link>
                    )}

                    <div className="border-t border-zinc-800/80 my-1" />

                    {/* Opção Sair */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-all cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 text-red-400" />
                      <span>Sair</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Toggle Menu Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu Gaveta Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#27272a] bg-[#141416] p-4 space-y-2 animate-fadeIn">
          <Link
            href="/explorar"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              isExplorarActive
                ? "bg-[#1e1e1e] text-white border border-[#27272a]"
                : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            <Compass className="h-4 w-4 text-[#00a2ff]" />
            <span>Explorar Torneios</span>
          </Link>

          {user && (
            <>
              <Link
                href="/hub"
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                  isHubActive
                    ? "bg-[#1e1e1e] text-white border border-[#27272a]"
                    : "text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <Sparkles className="h-4 w-4 text-[#00a2ff]" />
                <span>Hub Central</span>
              </Link>

              <Link
                href="/perfil"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-all"
              >
                <User className="h-4 w-4 text-[#00a2ff]" />
                <span>Meu Perfil</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-purple-300 bg-purple-500/10 border border-purple-500/25 flex items-center gap-2.5 transition-all"
                >
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  <span>⚙️ Central do Sistema</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-all text-left cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-red-400" />
                <span>Sair</span>
              </button>
            </>
          )}

          {!user && (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00a2ff] text-white flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar / Criar Conta</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
