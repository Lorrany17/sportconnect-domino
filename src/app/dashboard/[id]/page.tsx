"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import OrganizerDashboard from "@/components/OrganizerDashboard";
import { useTournament } from "@/context/TournamentContext";
import { supabase } from "@/lib/supabase";
import { Tournament, SportType } from "@/types";
import { Loader2 } from "lucide-react";

export default function TournamentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { setCurrentTournamentId } = useTournament();
  const id = (params?.id as string) || "";
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setCurrentTournamentId(id);

    async function fetchTournament() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (data && !error) {
          setTournament({
            id: data.id,
            name: data.name,
            status: data.status,
            createdAt: data.created_at,
            sport_type: (data.sport_type as SportType) || "DOMINO",
            format: data.format,
            owner_id: data.owner_id,
            max_teams: data.max_teams ? Number(data.max_teams) : 16,
            entry_fee: data.entry_fee ? Number(data.entry_fee) : 0,
            location: data.location,
            start_date: data.start_date,
            start_time: data.start_time,
            end_date: data.end_date,
            rules: data.rules,
            cover_url: data.cover_url,
            gender_category: data.gender_category,
            organizer_pix_key: data.organizer_pix_key,
            tournament_format: data.tournament_format,
            pix_key_type: data.pix_key_type,
            rulebook_url: data.rulebook_url,
            match_rules: data.match_rules,
            sponsors: data.sponsors || [],
            custom_registration_fields: data.custom_registration_fields,
            prize_first: data.prize_first,
            prize_second: data.prize_second,
            prize_third: data.prize_third,
            min_players: data.min_players,
            max_players: data.max_players,
            min_age: data.min_age,
            max_age: data.max_age,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar torneio no dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTournament();
  }, [id, setCurrentTournamentId]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Carregando painel do torneio...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0f0f0f] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 flex flex-col">
        <OrganizerDashboard
          tournament={tournament}
          onBack={() => router.push("/hub")}
        />
      </div>
    </ProtectedRoute>
  );
}
