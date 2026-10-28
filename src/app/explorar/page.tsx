"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Compass,
  Search,
  Trophy,
  Loader2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Tournament, SportType } from "@/types";
import { useTournament } from "@/context/TournamentContext";
import TournamentCard from "@/components/TournamentCard";
import PublicHeader from "@/components/PublicHeader";

export default function ExplorarPage() {
  const { tournaments: contextTournaments } = useTournament();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState("");

  const sportCategories: { id: string; label: string }[] = [
    { id: "TODOS", label: "Todos" },
    { id: "DOMINO", label: "Dominó" },
    { id: "FUTSAL", label: "Futsal" },
    { id: "PING_PONG", label: "Ping Pong" },
    { id: "VOLEI", label: "Vôlei" },
  ];

  // Fetch de torneios públicos com dados frescos e revalidação contínua
  useEffect(() => {
    let isMounted = true;

    async function fetchTournaments() {
      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select("*")
          .order("start_date", { ascending: false, nullsFirst: false });

        if (!isMounted) return;

        if (error) {
          console.warn("Aviso ao buscar torneios no Supabase:", error);
          if (contextTournaments && contextTournaments.length > 0) {
            setTournaments(contextTournaments);
          }
        } else if (data) {
          const mapped: Tournament[] = data.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            createdAt: t.created_at,
            sport_type: (t.sport_type as SportType) || "DOMINO",
            format: t.format,
            owner_id: t.owner_id,
            max_teams: t.max_teams ? Number(t.max_teams) : undefined,
            entry_fee: t.entry_fee ? Number(t.entry_fee) : undefined,
            location: t.location,
            start_date: t.start_date,
            start_time: t.start_time,
            end_date: t.end_date,
            rules: t.rules,
            cover_url: t.cover_url,
          }));
          setTournaments(mapped);
        }
      } catch (err) {
        console.error("Exceção ao buscar torneios:", err);
        if (isMounted && contextTournaments && contextTournaments.length > 0) {
          setTournaments(contextTournaments);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTournaments();

    // Revalidação imediata ao focar na aba
    const handleFocus = () => {
      fetchTournaments();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchTournaments();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Inscrição em tempo real na tabela de torneios
    const channel = supabase
      .channel("public-tournaments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => {
          fetchTournaments();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [contextTournaments]);

  // Filtragem dos torneios
  const filteredTournaments = tournaments.filter((t) => {
    const matchesSport =
      selectedSport === "TODOS" || (t.sport_type || "DOMINO") === selectedSport;
    const matchesSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (t.location && t.location.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    return matchesSport && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] flex flex-col justify-between selection:bg-[#00a2ff]/30 selection:text-white">
      <div>
        <PublicHeader activePage="explorar" />

        <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* 1. Cabeçalho Principal */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00a2ff] text-xs font-black uppercase tracking-wider mb-3">
              <Compass className="h-3.5 w-3.5" />
              <span>Explorador de Torneios</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight">
              Encontre Sua Arena
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 mt-3 leading-relaxed">
              Participe de competições e acompanhe sua ascensão rumo à glória.
            </p>
            <div className="mt-2.5">
              <span className="text-xs font-medium text-zinc-500">
                {filteredTournaments.length}{" "}
                {filteredTournaments.length === 1 ? "torneio disponível" : "torneios disponíveis"}
              </span>
            </div>
          </div>

        {/* 2. Filtros (Topo): Barra de Pesquisa e Botões Pills */}
        <div className="space-y-5 mb-10 max-w-2xl mx-auto">
          {/* Barra de Pesquisa */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar campeonato por nome ou local..."
              className="w-full pl-11 pr-4 py-3.5 bg-[#18181b] border border-zinc-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-2xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all shadow-inner"
            />
          </div>

          {/* Barra de botões (Pills) horizontal para filtrar por sport_type */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {sportCategories.map((cat) => {
              const isActive = selectedSport === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedSport(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-105"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Lista de Cards (Grid) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 bg-[#18181b] border border-zinc-800 rounded-2xl max-w-xl mx-auto w-full">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
            <p className="text-sm font-bold text-zinc-300">Carregando competições...</p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[320px] text-center p-8 bg-[#18181b] border border-zinc-800 rounded-2xl max-w-xl mx-auto w-full">
            <Trophy className="h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-lg font-black text-white mb-1 uppercase tracking-wide font-display">
              Nenhuma arena encontrada
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-4">
              Não encontramos nenhum campeonato com os filtros selecionados. Tente ajustar o esporte ou os termos de busca.
            </p>
            {(selectedSport !== "TODOS" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSport("TODOS");
                  setSearchQuery("");
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tour) => (
              <TournamentCard key={tour.id} tournament={tour} />
            ))}
          </div>
        )}
      </main>
      </div>

      {/* Rodapé da Página */}
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500 bg-[#141416]/50">
        <div>SportConnect • Portal de Competições Esportivas</div>
      </footer>
    </div>
  );
}
