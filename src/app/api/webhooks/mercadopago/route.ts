import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabase } from "@/lib/supabase";

// Inicializa o cliente do Mercado Pago V2
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});
const payment = new Payment(client);

/**
 * Função utilitária para executar a transferência via Pix (Pix Out) para o organizador.
 * Envia 90% do valor pago pelo atleta para a chave Pix cadastrada (organizer_pix_key).
 * Tenta primeiramente a API oficial de Payouts (/v1/payouts) do Mercado Pago,
 * com fallback para a API de Transferências diretas (/v1/transfers).
 */
async function executePixTransfer({
  amountToTransfer,
  organizerPixKey,
  teamId,
  teamName,
  tournamentName,
}: {
  amountToTransfer: number;
  organizerPixKey: string;
  teamId: string;
  teamName: string;
  tournamentName: string;
}) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não está configurado nas variáveis de ambiente.");
  }

  const cleanPixKey = organizerPixKey.trim();
  if (!cleanPixKey) {
    throw new Error("Chave Pix do organizador vazia ou não informada no torneio.");
  }

  const idempotencyKey = crypto.randomUUID();

  // Tentativa 1: Endpoint de Payouts oficial do Mercado Pago (/v1/payouts)
  const payoutsPayload = {
    description: `Repasse 90% Torneio SportConnect - ${tournamentName.slice(0, 30)}`,
    external_reference: `split_${teamId}_${Date.now()}`,
    transactions: [
      {
        amount: {
          currency: "BRL",
          value: amountToTransfer,
        },
        description: `Inscrição ${teamName || teamId}`,
        payment_method: {
          id: "pix",
          type: "bank_transfer",
        },
        recipient: {
          key: cleanPixKey,
        },
      },
    ],
  };

  try {
    const payoutRes = await fetch("https://api.mercadopago.com/v1/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payoutsPayload),
    });

    if (payoutRes.ok) {
      const data = await payoutRes.json();
      return { method: "payouts", data };
    }

    const payoutErrText = await payoutRes.text();
    console.warn(`[Mercado Pago Payouts ${payoutRes.status}]:`, payoutErrText);
  } catch (err) {
    console.warn("Exceção ao tentar endpoint de Payouts do Mercado Pago:", err);
  }

  // Tentativa 2: Rota de transferências diretas (/v1/transfers)
  const transfersPayload = {
    amount: amountToTransfer,
    description: `Repasse Torneio ${tournamentName.slice(0, 30)}`,
    pix_key: cleanPixKey,
    destination: {
      type: "pix",
      key: cleanPixKey,
    },
    metadata: {
      team_id: teamId,
      team_name: teamName,
      tournament_name: tournamentName,
      split: "90%",
    },
  };

  const transferRes = await fetch("https://api.mercadopago.com/v1/transfers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(transfersPayload),
  });

  if (transferRes.ok) {
    const data = await transferRes.json();
    return { method: "transfers", data };
  }

  const transferErrText = await transferRes.text();
  console.error(`[Mercado Pago Transfers ${transferRes.status}]:`, transferErrText);

  throw new Error(`Falha na API de transferência Pix do Mercado Pago: ${transferErrText}`);
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    console.log("Notificação de Webhook do Mercado Pago recebida:", {
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    });

    // 1. Extrair data.id (ID do pagamento)
    const paymentId =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");

    if (!paymentId) {
      console.log("Webhook do Mercado Pago recebido sem data.id (provável teste ou ping).");
      return NextResponse.json(
        { received: true, message: "Webhook recebido sem identificador de pagamento." },
        { status: 200 }
      );
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn("Aviso: MERCADOPAGO_ACCESS_TOKEN não configurado para processar webhook.");
      return NextResponse.json(
        { error: "Credenciais do Mercado Pago não configuradas." },
        { status: 500 }
      );
    }

    // 2. Consultar a API do Mercado Pago para verificar o status real desse pagamento
    const paymentInfo = await payment.get({ id: String(paymentId) });
    const paymentStatus = paymentInfo?.status;

    console.log(`Status do pagamento ${paymentId} no Mercado Pago:`, paymentStatus);

    // =========================================================================
    // 3. SE O STATUS FOR APPROVED: PROCESSAR SPLIT E REPASSE PIX
    // =========================================================================
    if (paymentStatus === "approved") {
      // 3.1 Localizar a inscrição (team)
      let team: any = null;

      const { data: teamByMpId, error: teamQueryError } = await supabase
        .from("teams")
        .select("id, name, tournament_id, status, payment_status, payout_status, mp_payment_id")
        .eq("mp_payment_id", String(paymentId))
        .maybeSingle();

      if (teamByMpId) {
        team = teamByMpId;
      } else if (paymentInfo?.metadata?.team_id) {
        // Fallback por metadata registrada no Mercado Pago
        const { data: teamByMeta } = await supabase
          .from("teams")
          .select("id, name, tournament_id, status, payment_status, payout_status, mp_payment_id")
          .eq("id", paymentInfo.metadata.team_id)
          .maybeSingle();

        if (teamByMeta) {
          team = teamByMeta;
        }
      }

      // Idempotência: Se o split já foi concluído anteriormente, não duplicar a transferência
      if (team?.payout_status === "COMPLETED") {
        console.log(`Repasse já concluído anteriormente para a equipe ${team.id} (${team.name}). Pulando transferência duplicada.`);
        return NextResponse.json(
          {
            received: true,
            paymentId: String(paymentId),
            status: paymentStatus,
            payout_status: "ALREADY_COMPLETED",
          },
          { status: 200 }
        );
      }

      // 3.2 Buscar dados do torneio e chave Pix do organizador (organizer_pix_key)
      const tournamentId = team?.tournament_id || paymentInfo?.metadata?.tournament_id;
      let tournament: any = null;
      let organizerPixKey = "";

      if (tournamentId) {
        const { data: tournData } = await supabase
          .from("tournaments")
          .select("id, name, organizer_pix_key, owner_id")
          .eq("id", tournamentId)
          .maybeSingle();

        if (tournData) {
          tournament = tournData;
          organizerPixKey = (tournData.organizer_pix_key || "").trim();
        }
      }

      // 3.3 Cálculo do Split (10% plataforma retidos, 90% organizador)
      const transactionAmount = Number(paymentInfo?.transaction_amount || 0);
      const amountToTransfer = Math.round(transactionAmount * 0.90 * 100) / 100;
      const platformFee = Math.round((transactionAmount - amountToTransfer) * 100) / 100;

      console.log(`[Split Financeiro MP] Total: R$ ${transactionAmount.toFixed(2)} | Organizador (90%): R$ ${amountToTransfer.toFixed(2)} | Plataforma SportConnect (10%): R$ ${platformFee.toFixed(2)}`);

      // 3.4 Execução da Transferência via Pix (Pix Out)
      let payoutStatus: "COMPLETED" | "FAILED_TRANSFER" = "FAILED_TRANSFER";
      let transferErrorDetails: string | null = null;
      let transferResult: any = null;

      if (!organizerPixKey) {
        payoutStatus = "FAILED_TRANSFER";
        transferErrorDetails = "Chave Pix do organizador não configurada no torneio.";
        console.warn(`[Split MP] Torneio ${tournamentId} não possui chave Pix do organizador configurada.`);
      } else if (amountToTransfer <= 0) {
        payoutStatus = "COMPLETED"; // Inscrição gratuita ou sem repasse pendente
      } else {
        try {
          console.log(`[Split MP] Executando Pix Out de R$ ${amountToTransfer.toFixed(2)} para chave: ${organizerPixKey}`);
          transferResult = await executePixTransfer({
            amountToTransfer,
            organizerPixKey,
            teamId: team?.id || String(paymentId),
            teamName: team?.name || "Equipe",
            tournamentName: tournament?.name || "Torneio",
          });
          payoutStatus = "COMPLETED";
          console.log("[Split MP] Transferência Pix concluída com sucesso:", transferResult);
        } catch (transferErr: any) {
          payoutStatus = "FAILED_TRANSFER";
          transferErrorDetails = transferErr?.message || "Falha na requisição de transferência Pix.";
          console.error("[Split MP] Erro ao transferir Pix para organizador:", transferErrorDetails);
        }
      }

      // 3.5 Atualização no Banco de Dados:
      // - Status da inscrição: PAID (o atleta realizou o pagamento com sucesso)
      // - payment_status: APPROVED (para compatibilidade contínua com todo o sistema)
      // - payout_status: COMPLETED (se split efetuado) ou FAILED_TRANSFER (para repasse manual pelo Super Admin)
      const updatePayload: Record<string, any> = {
        status: "PAID",
        payment_status: "APPROVED",
        payout_status: payoutStatus,
        payout_amount: amountToTransfer,
      };

      const teamIdentifier = team?.id;
      let { data: updatedTeams, error: updateError } = await supabase
        .from("teams")
        .update(updatePayload)
        .eq(teamIdentifier ? "id" : "mp_payment_id", teamIdentifier || String(paymentId))
        .select();

      // Fallback gracioso: caso a coluna payout_status ainda não tenha sido criada no Supabase (erro 42703)
      if (updateError && updateError.code === "42703") {
        console.warn("Aviso: Coluna 'payout_status' ainda não existe na tabela teams. Atualizando status e payment_status.");
        const fallbackRes = await supabase
          .from("teams")
          .update({
            status: "PAID",
            payment_status: "APPROVED",
          })
          .eq(teamIdentifier ? "id" : "mp_payment_id", teamIdentifier || String(paymentId))
          .select();
        updatedTeams = fallbackRes.data;
        updateError = fallbackRes.error;
      }

      if (updateError) {
        console.error("Erro ao atualizar equipe via webhook:", updateError);
        return NextResponse.json(
          { error: "Erro ao atualizar equipe no banco de dados.", details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`Inscrição aprovada via Webhook (${paymentId}): status=PAID, payout_status=${payoutStatus}`, updatedTeams);

      return NextResponse.json(
        {
          received: true,
          paymentId: String(paymentId),
          status: paymentStatus,
          teamStatus: "PAID",
          payout_status: payoutStatus,
          split: {
            total: transactionAmount,
            organizerAmount: amountToTransfer,
            platformFee,
            organizerPixKey: organizerPixKey ? `${organizerPixKey.slice(0, 4)}***` : null,
          },
          transferError: transferErrorDetails,
        },
        { status: 200 }
      );
    } else if (paymentStatus === "refunded") {
      // Se tiver sido estornado pelo Mercado Pago
      const { error: refundError } = await supabase
        .from("teams")
        .update({
          payment_status: "CANCELED",
          status: "CANCELED",
          cancellation_status: "REFUNDED",
        })
        .eq("mp_payment_id", String(paymentId));

      if (refundError) {
        console.warn("Erro ao atualizar estorno via webhook:", refundError);
      }
    }

    return NextResponse.json(
      {
        received: true,
        paymentId: String(paymentId),
        status: paymentStatus,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return NextResponse.json(
      {
        error: error?.message || "Erro interno ao processar webhook do Mercado Pago.",
      },
      { status: 500 }
    );
  }
}

// GET para health check ou verificação do painel do Mercado Pago
export async function GET() {
  return NextResponse.json(
    { status: "active", service: "Mercado Pago Webhook Route - SportConnect Split Pix" },
    { status: 200 }
  );
}
