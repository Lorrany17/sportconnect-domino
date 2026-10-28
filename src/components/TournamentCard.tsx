"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Calendar, Users, Trophy, ArrowRight } from "lucide-react";
import { Tournament, SportType } from "@/types";
import { DEFAULT_COVERS, SPORT_SELECT_OPTIONS } from "@/components/CreateTournamentForm";

export interface TournamentCardProps {
  tournament: Tournament;
}

export default function TournamentCard({ tournament }: TournamentCardProps) {
  const sportType: SportType = tournament.sport_type || "DOMINO";
  const coverImage = tournament.cover_url || DEFAULT_COVERS[sportType] || DEFAULT_COVERS.DOMINO;

  // Formatação de data
  const formatDate = (dateString?: string, timeString?: string) => {
    if (!dateString) return "Data a definir";
    try {
      let d: Date;
      if (typeof dateString === "string" && dateString.includes("-")) {
        const datePart = dateString.split("T")[0];
        const parts = datePart.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          d = new Date(dateString);
        }
      } else {
        d = new Date(dateString);
      }

      if (isNaN(d.getTime())) return "Data a definir";

      const formatted = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      if (timeString && timeString.trim()) {
        return `${formatted} às ${timeString.trim()}`;
      }

      return formatted;
    } catch {
      return "Data a definir";
    }
  };

  // Formatação do valor da inscrição
  const formatFee = (fee?: number) => {
    if (fee === undefined || fee === null || Number(fee) === 0) return "Gratuito";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(fee));
  };

  // Configuração da Badge de Status
  const getStatusBadge = () => {
    const status = tournament.status;

    if (status === "CANCELLED" || status === "CANCELADO") {
      return {
        text: "TORNEIO CANCELADO",
        classes: "bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/20",
        dot: "bg-red-400",
      };
    }

    if (status === "FINALIZADO" || status === "COMPLETED") {
      return {
        text: "FINALIZADO",
        classes: "bg-zinc-800/90 text-zinc-300 border-zinc-700/60",
        dot: "bg-zinc-500",
      };
    }

    if (status === "IN_PROGRESS" || status === "EM_ANDAMENTO" || status === "LIVE") {
      return {
        text: "EM ANDAMENTO",
        classes: "bg-amber-500/90 text-white border-amber-400/40 shadow-lg shadow-amber-500/20",
        dot: "bg-white animate-pulse",
      };
    }

    if (status === "CLOSED") {
      return {
        text: "INSCRIÇÕES ENCERRADAS",
        classes: "bg-red-500/90 text-white border-red-400/40 shadow-lg shadow-red-500/20",
        dot: "bg-white",
      };
    }

    // Apenas status OPEN estrito recebe a tag verde de inscrições abertas
    if (status === "OPEN") {
      return {
        text: "INSCRIÇÕES ABERTAS",
        classes: "bg-emerald-500/90 text-white border-emerald-400/40 shadow-lg shadow-emerald-500/20",
        dot: "bg-white animate-pulse",
      };
    }

    // Fallback para qualquer outro status
    return {
      text: "INSCRIÇÕES ENCERRADAS",
      classes: "bg-zinc-800/90 text-zinc-400 border-zinc-700/60",
      dot: "bg-zinc-500",
    };
  };

  const statusBadge = getStatusBadge();
  const sportMeta = SPORT_SELECT_OPTIONS.find((s) => s.id === sportType);

  // Label para contagem de equipes/duplas/atletas
  const getCapacityLabel = () => {
    const spots = tournament.max_teams || 16;
    if (sportType === "DOMINO" || tournament.format?.includes("Duplas")) {
      return `${spots} Duplas`;
    }
    if (sportType === "PING_PONG" && !tournament.format?.includes("Duplas")) {
      return `${spots} Jogadores`;
    }
    return `${spots} Equipes`;
  };

  return (
    <Link
      href={`/torneio/${tournament.id}`}
      className="group block bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/20 hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between"
    >
      <div>
        {/* Imagem de Capa (Metade Superior) */}
        <div className="relative h-48 w-full overflow-hidden bg-zinc-900">
          <img
            src={coverImage}
            alt={tournament.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Overlay gradiente escuro para legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-black/50" />

          {/* Badge de Modalidade (Canto Superior Esquerdo) */}
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-black text-white uppercase tracking-wider shadow-md">
              <span>{sportMeta?.icon || "🏆"}</span>
              <span>{sportMeta?.label || sportType}</span>
            </span>
          </div>

          {/* Badge de Status (Canto Superior Direito) */}
          <div className="absolute top-3 right-3 z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border text-[10px] font-black uppercase tracking-wider ${statusBadge.classes}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
              <span>{statusBadge.text}</span>
            </span>
          </div>
        </div>

        {/* Corpo do Card */}
        <div className="p-5 space-y-3">
          <h3 className="font-display font-black text-lg text-white group-hover:text-[#00a2ff] transition-colors line-clamp-1">
            {tournament.name}
          </h3>

          <div className="space-y-1.5 text-xs text-zinc-400">
            {/* Localização */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#00a2ff] shrink-0" />
              <span className="line-clamp-1">
                {tournament.location || "Local a definir"}
              </span>
            </div>

            {/* Data */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#00a2ff] shrink-0" />
              <span>{formatDate(tournament.start_date, tournament.start_time)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do Card */}
      <div className="px-5 py-4 border-t border-zinc-800/80 bg-[#161616] flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
            Inscrição
          </span>
          <span className="font-black text-white text-sm text-emerald-400">
            {formatFee(tournament.entry_fee)}
          </span>
        </div>

        <div className="text-right flex items-center gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Vagas
            </span>
            <span className="font-bold text-zinc-300 flex items-center gap-1 justify-end">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <span>{getCapacityLabel()}</span>
            </span>
          </div>

          <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-blue-600 group-hover:text-white text-zinc-400 flex items-center justify-center transition-colors">
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}
