"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export interface CancelRegistrationParams {
  teamId: string;
  status?: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED" | string;
  tournamentId?: string;
  userAuthToken?: string;
}

export interface CancelRegistrationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Server Action para cancelamento de inscrição solicitado pelo atleta.
 * 
 * Regra de Segurança:
 * Antes de processar o cancelamento ou estorno, verifica o status atual do torneio na tabela 'tournaments'.
 * Se o status for diferente de 'OPEN' (ex: 'CLOSED', 'IN_PROGRESS', 'FINALIZADO'), a operação é abortada
 * e retorna o erro: "Não é possível cancelar a inscrição: o chaveamento do torneio já foi gerado."
 */
export async function cancelRegistration(
  teamIdOrParams: string | CancelRegistrationParams,
  cancellationStatus: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED" | string = "REQUESTED_BY_ATHLETE",
  userAuthToken?: string
): Promise<CancelRegistrationResponse> {
  const teamId = typeof teamIdOrParams === "string" ? teamIdOrParams : teamIdOrParams?.teamId;
  const status =
    typeof teamIdOrParams === "string"
      ? cancellationStatus
      : teamIdOrParams?.status || cancellationStatus || "REQUESTED_BY_ATHLETE";
  let explicitToken = typeof teamIdOrParams === "string" ? userAuthToken : teamIdOrParams?.userAuthToken;

  if (!teamId) {
    return { success: false, error: "ID da inscrição não informado." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: "Configuração do Supabase ausente no servidor." };
  }

  // Recupera token de autenticação dos cookies se não fornecido
  let authToken = explicitToken;
  if (!authToken) {
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      const tokenCookie =
        cookieStore.get("sb-access-token") ||
        cookieStore.get("supabase-auth-token") ||
        allCookies.find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

      if (tokenCookie?.value) {
        try {
          const parsed = JSON.parse(tokenCookie.value);
          if (Array.isArray(parsed) && parsed[0]) {
            authToken = parsed[0];
          } else if (parsed?.access_token) {
            authToken = parsed.access_token;
          } else {
            authToken = tokenCookie.value;
          }
        } catch {
          authToken = tokenCookie.value;
        }
      }
    } catch {
      // Cookies podem não estar disponíveis em alguns runtimes
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: authToken
      ? {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      : undefined,
  });

  try {
    // 1. Busca a equipe inscrita e descobre o torneio vinculado
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id, name, tournament_id, cancellation_status")
      .eq("id", teamId)
      .maybeSingle();

    if (teamErr) {
      console.error("Erro ao buscar equipe para cancelamento:", teamErr);
      return { success: false, error: `Erro ao buscar inscrição: ${teamErr.message}` };
    }

    if (!team) {
      return { success: false, error: "Inscrição não encontrada." };
    }

    const tournamentId =
      team.tournament_id ||
      (typeof teamIdOrParams !== "string" ? teamIdOrParams.tournamentId : undefined);

    if (!tournamentId) {
      return { success: false, error: "Torneio não vinculado a esta inscrição." };
    }

    // 2. Trava de Segurança no Servidor: Consulta o status atual do torneio
    const { data: tournament, error: tourErr } = await supabase
      .from("tournaments")
      .select("id, name, status")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tourErr) {
      console.error("Erro ao verificar status do torneio:", tourErr);
      return { success: false, error: `Erro ao consultar torneio: ${tourErr.message}` };
    }

    if (!tournament) {
      return { success: false, error: "Torneio correspondente não foi encontrado." };
    }

    // Se o status for diferente de 'OPEN' (ex: 'CLOSED', 'IN_PROGRESS', 'FINALIZADO', etc.)
    if (tournament.status !== "OPEN") {
      return {
        success: false,
        error: "Não é possível cancelar a inscrição: o chaveamento do torneio já foi gerado.",
      };
    }

    // 3. Atualiza o status de cancelamento da inscrição
    const { error: updateErr } = await supabase
      .from("teams")
      .update({ cancellation_status: status })
      .eq("id", teamId);

    if (updateErr) {
      console.error("Erro ao atualizar status de cancelamento:", updateErr);
      return { success: false, error: `Erro ao solicitar cancelamento: ${updateErr.message}` };
    }

    return {
      success: true,
      message: "Cancelamento solicitado com sucesso.",
    };
  } catch (err: any) {
    console.error("Exceção na Server Action cancelRegistration:", err);
    return {
      success: false,
      error: err?.message || "Ocorreu um erro inesperado ao cancelar a inscrição.",
    };
  }
}

/**
 * Alias com nome alternativo conforme especificação (withdrawFromTournament)
 */
export async function withdrawFromTournament(
  teamIdOrParams: string | CancelRegistrationParams,
  cancellationStatus: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED" | string = "REQUESTED_BY_ATHLETE",
  userAuthToken?: string
): Promise<CancelRegistrationResponse> {
  return await cancelRegistration(teamIdOrParams, cancellationStatus, userAuthToken);
}
