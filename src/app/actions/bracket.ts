"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  cancelRegistration as baseCancelRegistration,
  type CancelRegistrationParams,
  type CancelRegistrationResponse,
} from "./registration";

export interface GenerateBracketResponse {
  success: boolean;
  message?: string;
  error?: string;
  matchesCount?: number;
}

/**
 * Server Action que gera a árvore matemática de chaveamento eliminatório (Mata-Mata).
 *
 * 1. Busca todas as equipes com payment_status = 'PAID' (ou aprovadas/confirmadas).
 * 2. Embaralha (Fisher-Yates) as equipes para sorteio 100% aleatório.
 * 3. Calcula a potência de 2 mais próxima (4, 8, 16, 32...) e preenche vagas vazias com BYE (avanço automático).
 * 4. Faz INSERT em lote na tabela matches começando da final (round mais alto) descendo até o round 1.
 * 5. Vincula o id da partida futura no next_match_id das partidas anteriores.
 * 6. Apenas as partidas do round 1 recebem os team1_id e team2_id reais.
 */
export async function generateBracket(
  tournament_id: string,
  userAuthToken?: string
): Promise<GenerateBracketResponse> {
  if (!tournament_id) {
    return { success: false, error: "ID do torneio não fornecido." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: "Configuração do Supabase ausente no servidor." };
  }

  // Recupera o token de autenticação dos cookies ou do parâmetro
  let authToken = userAuthToken;
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
    } catch (e) {
      // Cookies podem não estar disponíveis em alguns runtimes
    }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
    // 1. Verifica se já existem partidas criadas para este torneio
    const { count: existingCount, error: countErr } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament_id);

    if (countErr) {
      console.warn("Aviso ao checar partidas existentes:", countErr);
    }

    if (existingCount && existingCount > 0) {
      return {
        success: false,
        error: "O chaveamento deste torneio já foi gerado anteriormente.",
      };
    }

    // 2. Busca todas as equipes inscritas com payment_status = 'PAID' (incluindo APPROVED/CONFIRMED)
    const { data: teamsData, error: teamsErr } = await supabase
      .from("teams")
      .select("id, name, status, payment_status")
      .eq("tournament_id", tournament_id)
      .or("payment_status.eq.PAID,payment_status.eq.APPROVED,status.eq.CONFIRMED,status.eq.PAID");

    if (teamsErr) {
      return { success: false, error: `Erro ao buscar equipes: ${teamsErr.message}` };
    }

    if (!teamsData || teamsData.length < 2) {
      return {
        success: false,
        error: "É necessário ter pelo menos 2 equipes confirmadas para gerar o chaveamento.",
      };
    }

    // 3. Embaralha (Shuffle) o array de equipes para garantir sorteio aleatório
    const shuffledTeams = [...teamsData];
    for (let i = shuffledTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
    }

    // 4. Calcula a potência de 2 mais próxima (ex: 4, 8, 16, 32...) baseada no número de equipes
    const numTeams = shuffledTeams.length;
    let bracketSize = 2;
    while (bracketSize < numTeams) {
      bracketSize *= 2;
    }
    const totalRounds = Math.log2(bracketSize);

    // Distribuição do Round 1 garantindo que nenhum confronto tenha BYE vs BYE
    const round1MatchCount = bracketSize / 2;
    const round1Pairs: {
      team1: { id: string; name: string } | null;
      team2: { id: string; name: string } | null;
    }[] = [];
    let teamIdx = 0;

    // Atribui o primeiro time para cada confronto da rodada 1
    for (let i = 0; i < round1MatchCount; i++) {
      round1Pairs.push({
        team1: shuffledTeams[teamIdx++] || null,
        team2: null,
      });
    }

    // Atribui o segundo time com as equipes restantes ou preenche com null (BYE - Avanço Automático)
    for (let i = 0; i < round1MatchCount; i++) {
      if (teamIdx < shuffledTeams.length) {
        round1Pairs[i].team2 = shuffledTeams[teamIdx++];
      } else {
        round1Pairs[i].team2 = null; // BYE
      }
    }

    // 5. Nomes das fases
    const getPhaseName = (round: number, total: number) => {
      const distance = total - round;
      if (distance === 0) return "Final";
      if (distance === 1) return "Semifinal";
      if (distance === 2) return "Quartas de Final";
      if (distance === 3) return "Oitavas de Final";
      if (distance === 4) return "16 avos de Final";
      return `Rodada ${round}`;
    };

    // Monta a árvore inicial de confrontos da final até a primeira rodada
    const matchesByRound = new Map<number, any[]>();

    for (let r = totalRounds; r >= 1; r--) {
      const numMatchesInRound = bracketSize / Math.pow(2, r);
      const currentRoundList: any[] = [];

      for (let i = 0; i < numMatchesInRound; i++) {
        const matchId = crypto.randomUUID();
        let nextMatchId: string | null = null;

        // Vincula o id da partida futura no next_match_id das partidas anteriores
        if (r < totalRounds) {
          const nextRoundMatches = matchesByRound.get(r + 1);
          if (nextRoundMatches) {
            const nextMatchIdx = Math.floor(i / 2);
            nextMatchId = nextRoundMatches[nextMatchIdx]?.id || null;
          }
        }

        let team1Id: string | null = null;
        let team2Id: string | null = null;

        // Apenas as partidas do round 1 recebem as equipes reais sorteadas
        if (r === 1) {
          team1Id = round1Pairs[i]?.team1?.id || null;
          team2Id = round1Pairs[i]?.team2?.id || null;
        }

        const phase = getPhaseName(r, totalRounds);

        const matchRow = {
          id: matchId,
          tournament_id,
          round: r,
          match_order: i + 1,
          next_match_id: nextMatchId,
          team1_id: team1Id,
          team2_id: team2Id,
          // Compatibilidade mútua com colunas clássicas team_a_id e team_b_id
          team_a_id: team1Id,
          team_b_id: team2Id,
          status: "SCHEDULED",
          phase,
          winner_id: null as string | null,
          score_a: 0,
          score_b: 0,
          sets_a: 0,
          sets_b: 0,
        };

        currentRoundList.push(matchRow);
      }

      matchesByRound.set(r, currentRoundList);
    }

    // 6. Refinamento da Lógica de BYE (Avanço Automático):
    // Verifica os confrontos da primeira fase (round: 1).
    // Quando uma equipe real for sorteada contra uma vaga vazia (BYE), o que significa que o team2_id ficará vazio:
    // - Marca imediatamente o status dessa partida como COMPLETED.
    // - Define o winner_id com o ID da equipe real que sobrou.
    // - Insere este winner_id no slot correto (team1_id ou team2_id) da próxima partida indicada no next_match_id.
    const round1Matches = matchesByRound.get(1) || [];
    const byeAdvancements: {
      nextMatchId: string;
      slot: "team1_id" | "team2_id";
      legacySlot: "team_a_id" | "team_b_id";
      winnerId: string;
    }[] = [];

    for (let i = 0; i < round1Matches.length; i++) {
      const match = round1Matches[i];
      const hasTeam1 = Boolean(match.team1_id);
      const hasTeam2 = Boolean(match.team2_id);

      // Se há uma equipe real e a outra é vaga vazia (BYE)
      if ((hasTeam1 && !hasTeam2) || (!hasTeam1 && hasTeam2)) {
        const survivingTeamId = (match.team1_id || match.team2_id) as string;

        match.status = "COMPLETED";
        match.winner_id = survivingTeamId;

        // Se houver próxima rodada (totalRounds > 1)
        if (totalRounds > 1 && match.next_match_id) {
          const round2Matches = matchesByRound.get(2);
          if (round2Matches) {
            const nextMatchIdx = Math.floor(i / 2);
            const nextMatch = round2Matches[nextMatchIdx];

            if (nextMatch) {
              const isEven = i % 2 === 0;
              const slot = isEven ? "team1_id" : "team2_id";
              const legacySlot = isEven ? "team_a_id" : "team_b_id";

              nextMatch[slot] = survivingTeamId;
              nextMatch[legacySlot] = survivingTeamId;

              byeAdvancements.push({
                nextMatchId: match.next_match_id,
                slot,
                legacySlot,
                winnerId: survivingTeamId,
              });
            }
          }
        }
      }
    }

    // Coleta todas as partidas atualizadas para o INSERT em lote (começando da final até a 1ª fase)
    const allMatchesToInsert: any[] = [];
    for (let r = totalRounds; r >= 1; r--) {
      const list = matchesByRound.get(r) || [];
      allMatchesToInsert.push(...list);
    }

    // 7. Faz o INSERT em lote das partidas na tabela matches
    const { error: insertErr } = await supabase.from("matches").insert(allMatchesToInsert);

    if (insertErr) {
      console.warn("Aviso ao tentar insert com novas colunas:", insertErr);
      // Fallback caso as colunas round / team1_id / winner_id ainda não tenham sido migradas no Supabase
      if (
        insertErr.message?.includes("column") ||
        insertErr.message?.includes("team1_id") ||
        insertErr.message?.includes("round") ||
        insertErr.message?.includes("winner_id") ||
        insertErr.message?.includes("next_match_id")
      ) {
        const legacyMatches = allMatchesToInsert.map((m) => ({
          id: m.id,
          tournament_id: m.tournament_id,
          phase: m.phase,
          status: m.status,
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          score_a: 0,
          score_b: 0,
          sets_a: 0,
          sets_b: 0,
        }));

        const { error: legacyErr } = await supabase.from("matches").insert(legacyMatches);
        if (legacyErr) {
          return { success: false, error: `Erro ao inserir partidas: ${legacyErr.message}` };
        }
      } else {
        return { success: false, error: `Erro ao inserir partidas: ${insertErr.message}` };
      }
    }

    // 8. Executa o UPDATE explícito no banco para garantir a integridade dos slots das próximas partidas com BYE
    for (const adv of byeAdvancements) {
      try {
        await supabase
          .from("matches")
          .update({
            [adv.slot]: adv.winnerId,
            [adv.legacySlot]: adv.winnerId,
          })
          .eq("id", adv.nextMatchId);
      } catch (updErr) {
        console.warn("Aviso ao rodar update explícito de avanço de BYE:", updErr);
      }
    }

    // 9. Atualiza o status do torneio para IN_PROGRESS (fechando automaticamente as inscrições)
    const { error: tourUpdateErr } = await supabase
      .from("tournaments")
      .update({ status: "IN_PROGRESS" })
      .eq("id", tournament_id);

    if (tourUpdateErr) {
      console.warn("Aviso ao atualizar status do torneio para IN_PROGRESS na geração do chaveamento:", tourUpdateErr);
    }

    return {
      success: true,
      message: `Chaveamento oficial gerado com sucesso! ${allMatchesToInsert.length} partidas criadas. Inscrições encerradas.`,
      matchesCount: allMatchesToInsert.length,
    };
    } catch (err: any) {
      console.error("Exceção ao gerar chaveamento:", err);
      return {
        success: false,
        error: err.message || "Ocorreu um erro inesperado ao gerar o chaveamento.",
      };
    }
  }

  export interface CompleteMatchParams {
    matchId: string;
    scoreA: number;
    scoreB: number;
    setsA?: number;
    setsB?: number;
    winnerId?: string;
    sportType?: string;
    userAuthToken?: string;
    setHistory?: Array<{ setNumber: number; scoreA: number; scoreB: number }>;
    detailedScore?: { rounds?: Array<{ roundNumber: number; winnerTeamId?: string; pointsGenerated?: number; note?: string }> };
    penaltiesA?: number;
    penaltiesB?: number;
  }

  export interface CompleteMatchResponse {
    success: boolean;
    message?: string;
    error?: string;
    winnerId?: string;
    nextMatchId?: string | null;
    advancedToSlot?: string | null;
  }

  /**
   * Server Action que finaliza uma partida na súmula digital e atualiza a tabela matches.
   *
   * 1. Define o winner_id estritamente com base nos sets (para modalidades controladas por sets como Ping Pong e Vôlei)
   *    ou com base na pontuação/gols (como Futsal e Dominó).
   * 2. Atualiza o status da partida para 'COMPLETED', com score_a, score_b, sets_a, sets_b e winner_id.
   * 3. Se houver next_match_id, insere o winner_id no slot correto (team1_id ou team2_id) da próxima partida.
   */
  export async function completeMatchAction(
    params: CompleteMatchParams
  ): Promise<CompleteMatchResponse> {
    const { matchId, scoreA, scoreB, setsA = 0, setsB = 0, userAuthToken, sportType } = params;

    if (!matchId) {
      return { success: false, error: "ID da partida não fornecido." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, error: "Configuração do Supabase ausente no servidor." };
    }

    let authToken = userAuthToken;
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
        // Cookies podem não estar disponíveis
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
      // 1. Busca a partida no Supabase
      const { data: match, error: fetchErr } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();

      if (fetchErr || !match) {
        return {
          success: false,
          error: `Partida não encontrada no banco: ${fetchErr?.message || "ID inexistente"}`,
        };
      }

      const team1_id = match.team1_id || match.team_a_id;
      const team2_id = match.team2_id || match.team_b_id;

      // 2. Determinação estrita do vencedor:
      // const winner_id = team1Score > team2Score ? team1_id : team2_id; (ou utilizando o total de sets)
      const isSetsSport =
        sportType === "PING_PONG" ||
        sportType === "VOLEI" ||
        setsA > 0 ||
        setsB > 0 ||
        (match.phase && match.phase.toLowerCase().includes("semi") && sportType === "DOMINO");

      let calculatedWinnerId: string | null = null;

      if (isSetsSport && (setsA > 0 || setsB > 0 || setsA !== setsB)) {
        // Prioridade estrita para o total de sets
        calculatedWinnerId = setsA > setsB ? team1_id : team2_id;
      } else {
        // Modalidade baseada em pontuação direta (gols ou pontos corridos)
        calculatedWinnerId = scoreA > scoreB ? team1_id : team2_id;
      }

      const finalWinnerId = calculatedWinnerId || params.winnerId || null;

      if (!finalWinnerId) {
        return {
          success: false,
          error: "Não foi possível definir o vencedor do confronto (placar empatado ou times indefinidos).",
        };
      }

      // 3. Atualiza a partida atual no banco de dados
      const currentUpdate: any = {
        status: "COMPLETED",
        score_a: scoreA,
        score_b: scoreB,
        sets_a: setsA,
        sets_b: setsB,
        winner_id: finalWinnerId,
        set_history: params.setHistory || [],
        sets_history: params.setHistory || [],
        history: params.setHistory || [],
        details: {
          sets: params.setHistory || [],
          rounds: params.detailedScore?.rounds || [],
        },
        detailed_score: params.detailedScore || { rounds: [] },
        penalties_a: params.penaltiesA || 0,
        penalties_b: params.penaltiesB || 0,
      };

      const { error: updErr } = await supabase
        .from("matches")
        .update(currentUpdate)
        .eq("id", match.id);

      if (updErr) {
        console.warn("Aviso ao tentar atualizar partida com novas colunas:", updErr);
        // Fallback para schema legado caso winner_id ainda não exista
        const legacyUpdate: any = {
          status: "COMPLETED",
          score_a: scoreA,
          score_b: scoreB,
          sets_a: setsA,
          sets_b: setsB,
        };
        const { error: legErr } = await supabase
          .from("matches")
          .update(legacyUpdate)
          .eq("id", match.id);

        if (legErr) {
          return { success: false, error: `Erro ao atualizar partida: ${legErr.message}` };
        }
      }

      // 4. Avanço no Chaveamento: Garante que o winner_id CORRETO faz o UPDATE no next_match_id
      let advancedSlot: string | null = null;
      if (match.next_match_id) {
        // Na árvore mata-mata, os confrontos de ordem ímpar (1, 3, 5...) alimentam o slot 1 (team1_id / team_a_id)
        // e os de ordem par (2, 4, 6...) alimentam o slot 2 (team2_id / team_b_id) da próxima partida.
        const order = match.match_order || 1;
        const isSlot1 = (order - 1) % 2 === 0;
        const slot = isSlot1 ? "team1_id" : "team2_id";
        const legacySlot = isSlot1 ? "team_a_id" : "team_b_id";
        advancedSlot = slot;

        const nextUpdate: any = {
          [slot]: finalWinnerId,
          [legacySlot]: finalWinnerId,
        };

        const { error: nextErr } = await supabase
          .from("matches")
          .update(nextUpdate)
          .eq("id", match.next_match_id);

        if (nextErr) {
          console.warn("Aviso ao tentar atualizar próxima fase com novas colunas:", nextErr);
          await supabase
            .from("matches")
            .update({ [legacySlot]: finalWinnerId })
            .eq("id", match.next_match_id);
        }
      }

      return {
        success: true,
        message: "Resultado oficializado e chaveamento atualizado com sucesso!",
        winnerId: finalWinnerId,
        nextMatchId: match.next_match_id,
        advancedToSlot: advancedSlot,
      };
    } catch (err: any) {
      console.error("Exceção ao finalizar partida:", err);
      return {
        success: false,
        error: err.message || "Erro inesperado ao oficializar partida.",
      };
    }
  }

  /**
   * Server Action para buscar as partidas do chaveamento garantindo a extração
   * explícita do histórico em JSONB (sets_history, set_history, history, details).
   */
  export async function getTournamentMatches(tournament_id: string) {
    if (!tournament_id) return [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Configuração do Supabase ausente no servidor.");
      return [];
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament_id);

    if (error) {
      console.error("Erro ao buscar partidas no getTournamentMatches:", error);
      return [];
    }

    return (data || []).map((dbM: any) => {
      const candidates: any[] = [
        dbM.sets_history,
        dbM.set_history,
        dbM.history,
        dbM.details?.sets,
        dbM.details?.set_history,
        dbM.details?.sets_history,
        dbM.detailed_score?.sets,
        dbM.historicoSets,
        dbM.historico_sets,
      ];

      if (typeof dbM.details === "string") {
        try {
          const pd = JSON.parse(dbM.details);
          if (Array.isArray(pd)) candidates.push(pd);
          if (Array.isArray(pd?.sets)) candidates.push(pd.sets);
          if (Array.isArray(pd?.set_history)) candidates.push(pd.set_history);
        } catch {}
      }

      if (typeof dbM.detailed_score === "string") {
        try {
          const pds = JSON.parse(dbM.detailed_score);
          if (Array.isArray(pds)) candidates.push(pds);
          if (Array.isArray(pds?.sets)) candidates.push(pds.sets);
        } catch {}
      }

      let foundSets: any[] | null = null;
      for (const cand of candidates) {
        if (!cand) continue;
        let val = cand;
        if (typeof val === "string") {
          try {
            val = JSON.parse(val);
          } catch {
            val = null;
          }
        }
        if (Array.isArray(val) && val.length > 0) {
          foundSets = val;
          break;
        }
      }

      return {
        ...dbM,
        ...(foundSets && foundSets.length > 0
          ? {
              sets_history: foundSets,
              set_history: foundSets,
              history: foundSets,
              historicoSets: foundSets,
            }
          : {}),
      };
    });
  }

export async function cancelRegistration(
  teamIdOrParams: string | CancelRegistrationParams,
  cancellationStatus: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED" | string = "REQUESTED_BY_ATHLETE",
  userAuthToken?: string
): Promise<CancelRegistrationResponse> {
  return await baseCancelRegistration(teamIdOrParams, cancellationStatus, userAuthToken);
}

export async function withdrawFromTournament(
  teamIdOrParams: string | CancelRegistrationParams,
  cancellationStatus: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED" | string = "REQUESTED_BY_ATHLETE",
  userAuthToken?: string
): Promise<CancelRegistrationResponse> {
  return await baseCancelRegistration(teamIdOrParams, cancellationStatus, userAuthToken);
}
