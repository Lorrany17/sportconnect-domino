"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { TournamentPermissions, TournamentRole } from "@/types";

export function useTournamentPermissions(tournamentId?: string) {
  const { user } = useAuth();

  const [permissions, setPermissions] = useState<TournamentPermissions>({
    canEditSettings: false,
    canManageFinances: false,
    canEditScores: false,
    role: null,
    isOwner: false,
    isAdmin: false,
    isReferee: false,
    isScorekeeper: false,
    isLoading: true,
  });

  const fetchPermissions = useCallback(async () => {
    if (!tournamentId) {
      setPermissions({
        canEditSettings: false,
        canManageFinances: false,
        canEditScores: false,
        role: null,
        isOwner: false,
        isAdmin: false,
        isReferee: false,
        isScorekeeper: false,
        isLoading: false,
      });
      return;
    }

    if (!user) {
      setPermissions({
        canEditSettings: false,
        canManageFinances: false,
        canEditScores: false,
        role: null,
        isOwner: false,
        isAdmin: false,
        isReferee: false,
        isScorekeeper: false,
        isLoading: false,
      });
      return;
    }

    try {
      // 1. Super Admin global do sistema
      let isSuperAdmin =
        user.email === "admin@sportconnect.com" ||
        user.email === "santoslorrany250@gmail.com" ||
        user.user_metadata?.role === "admin" ||
        user.id === "organizer-admin-session";

      if (!isSuperAdmin && user.id) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.is_admin === true) {
            isSuperAdmin = true;
          }
        } catch (pErr) {
          console.warn("Aviso ao checar is_admin no hook:", pErr);
        }
      }

      // 2. Buscar o torneio para verificar o owner_id
      const { data: tourData, error: tourError } = await supabase
        .from("tournaments")
        .select("id, owner_id")
        .eq("id", tournamentId)
        .maybeSingle();

      if (tourError) {
        console.warn("Aviso ao buscar permissões do torneio:", tourError.message);
      }

      // Se for o dono do campeonato ou Super Admin
      const isOwner = Boolean(
        tourData?.owner_id && tourData.owner_id === user.id
      );

      if (isOwner || isSuperAdmin) {
        setPermissions({
          canEditSettings: true,
          canManageFinances: true,
          canEditScores: true,
          role: "OWNER",
          isOwner: true,
          isAdmin: true,
          isReferee: true,
          isScorekeeper: true,
          isLoading: false,
        });
        return;
      }

      // 3. Consultar a tabela tournament_staff pelo e-mail ou user_id
      const userEmail = user.email?.toLowerCase().trim();
      const { data: staffData, error: staffError } = await supabase
        .from("tournament_staff")
        .select("*")
        .eq("tournament_id", tournamentId);

      if (staffError) {
        console.warn("Aviso ao buscar staff do torneio:", staffError.message);
      }

      const matchingStaff = (staffData || []).find((s: any) => {
        const matchesUser = s.user_id && s.user_id === user.id;
        const matchesEmail =
          s.email && s.email.toLowerCase().trim() === userEmail;
        return matchesUser || matchesEmail;
      });

      if (matchingStaff) {
        // Se ainda não estava vinculado ao user_id, vincula automaticamente
        if (!matchingStaff.user_id && user.id) {
          supabase
            .from("tournament_staff")
            .update({ user_id: user.id })
            .eq("id", matchingStaff.id)
            .then();
        }

        const role = matchingStaff.role as TournamentRole;

        if (role === "ADMIN") {
          setPermissions({
            canEditSettings: true,
            canManageFinances: true,
            canEditScores: true,
            role: "ADMIN",
            isOwner: false,
            isAdmin: true,
            isReferee: true,
            isScorekeeper: true,
            isLoading: false,
          });
          return;
        }

        if (role === "REFEREE") {
          setPermissions({
            canEditSettings: false,
            canManageFinances: false,
            canEditScores: true,
            role: "REFEREE",
            isOwner: false,
            isAdmin: false,
            isReferee: true,
            isScorekeeper: true,
            isLoading: false,
          });
          return;
        }

        if (role === "SCOREKEEPER") {
          setPermissions({
            canEditSettings: false,
            canManageFinances: false,
            canEditScores: true,
            role: "SCOREKEEPER",
            isOwner: false,
            isAdmin: false,
            isReferee: false,
            isScorekeeper: true,
            isLoading: false,
          });
          return;
        }
      }

      // Sem acesso de staff registrado
      setPermissions({
        canEditSettings: false,
        canManageFinances: false,
        canEditScores: false,
        role: null,
        isOwner: false,
        isAdmin: false,
        isReferee: false,
        isScorekeeper: false,
        isLoading: false,
      });
    } catch (err) {
      console.error("Exceção ao calcular permissões do torneio:", err);
      setPermissions({
        canEditSettings: false,
        canManageFinances: false,
        canEditScores: false,
        role: null,
        isOwner: false,
        isAdmin: false,
        isReferee: false,
        isScorekeeper: false,
        isLoading: false,
      });
    }
  }, [tournamentId, user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    ...permissions,
    refetch: fetchPermissions,
  };
}
