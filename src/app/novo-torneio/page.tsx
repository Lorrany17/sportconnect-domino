"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import CreateTournamentForm from "@/components/CreateTournamentForm";

export default function NovoTorneioPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full mx-auto">
          {/* Botão Voltar */}
          <div className="mb-6">
            <Link
              href="/hub"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-zinc-800 border border-[#333] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-blue-500" />
              <span>Voltar ao Hub</span>
            </Link>
          </div>

          {/* Formulário "Configurar Novo Torneio" */}
          <CreateTournamentForm />
        </div>

        <footer className="mt-8 text-center text-[10px] text-zinc-600 uppercase tracking-widest">
          SportConnect • Plataforma de Gestão Esportiva
        </footer>
      </div>
    </ProtectedRoute>
  );
}
