/* eslint-disable react-hooks/set-state-in-effect */
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, ClipboardList, Network, Radio, LogIn, LogOut, LayoutDashboard, Sun, Moon } from "lucide-react";
import { useTournament } from "@/context/TournamentContext";
import { useTheme } from "next-themes";

interface NavbarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  isAdminLayout?: boolean;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  isAdminLayout = false,
}: NavbarProps) {
  const { teams, matches, isAdmin, logout } = useTournament();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const teamCount = teams.length;
  const activeMatchCount = matches.filter((m) => m.status === "LIVE").length;

  const tabs = [
    { id: "teams", name: "Gestão de Duplas", icon: Users },
    { id: "referee", name: "Área do Árbitro (Súmula)", icon: ClipboardList },
    { id: "bracket", name: "Árvore de Confrontos", icon: Network },
  ];

  return (
    <header className="w-full py-3 border-b sticky top-0 z-40 bg-white dark:bg-[#0a0a0a] dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="SportConnect Logo"
              width={120}
              height={40}
              className="w-auto h-8 object-contain"
              priority
            />
            <div>
              <div className="text-[10px] font-semibold text-brand-text-muted tracking-widest uppercase">
                Torneio de Dominó
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Admin Mode) */}
          {isAdminLayout && setActiveTab && (
            <nav className="hidden md:flex space-x-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 cursor-pointer ${isActive
                        ? "bg-brand-electric text-white shadow-lg shadow-brand-electric/25 transform scale-105"
                        : "text-brand-text-muted hover:text-white hover:bg-neutral-900/60"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Quick Info Badges & Admin Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-neutral-950/20 dark:bg-neutral-900/80 border border-neutral-200 dark:border-brand-border px-3 py-1.5 text-xs">
              <Users className="h-3.5 w-3.5 text-brand-electric-light" />
              <span className="font-bold text-neutral-500 dark:text-brand-text-muted">
                Duplas: <span className="text-neutral-800 dark:text-brand-text font-black">{teamCount}</span>
              </span>
            </div>

            {activeMatchCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-brand-neon-orange/10 border border-brand-neon-orange/20 px-3 py-1.5 text-xs animate-pulse-slow">
                <Radio className="h-3.5 w-3.5 text-brand-neon" />
                <span className="font-bold text-brand-neon">
                  Ao Vivo: <span className="text-white font-black">{activeMatchCount}</span>
                </span>
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-brand-border text-neutral-800 dark:text-neutral-300 transition-all cursor-pointer hover:text-brand-electric dark:hover:text-brand-neon active:scale-95 flex items-center justify-center"
              title="Alternar Tema"
            >
              {!mounted ? (
                <div className="h-4 w-4" />
              ) : resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Admin Layout Buttons */}
            {isAdminLayout ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-xs font-bold text-red-500 hover:text-red-400 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            ) : (
              <>
                {isAdmin ? (
                  <>
                    <Link
                      href="/admin"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-electric text-xs font-bold text-white hover:bg-brand-electric/80 transition-all cursor-pointer shadow-lg shadow-brand-electric/20"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Painel Admin</span>
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-brand-border hover:bg-neutral-200 dark:hover:border-neutral-700 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-brand-text-muted dark:hover:text-white transition-all cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sair</span>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-electric text-xs font-bold text-white hover:bg-brand-electric/85 transition-all cursor-pointer shadow-lg shadow-brand-electric/25"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Acessar Painel</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs (Admin Mode Only) */}
        {isAdminLayout && setActiveTab && (
          <div className="md:hidden flex border-t border-neutral-200 dark:border-brand-border/40 py-2 justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isActive ? "text-brand-electric" : "text-neutral-500 dark:text-brand-text-muted"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
