import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabase } from "@/lib/supabase";

// Inicializa o cliente do Mercado Pago para consultas de leitura (se necessário)
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});
const payment = new Payment(client);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const teamId = body?.team_id || body?.teamId;

    if (!teamId) {
      return NextResponse.json(
        { error: "Parâmetro 'team_id' é obrigatório para acionar o split manual." },
        { status: 400 }
      );
    }

    // 1. Buscar dados da equipe
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, tournament_id, status, payment_status, mp_payment_id, player1, manager_name")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError || !team) {
      return NextResponse.json(
        { error: "Equipe não encontrada no banco de dados.", details: teamError?.message },
        { status: 404 }
      );
    }

    // 2. Buscar dados do torneio (valor de inscrição e chave Pix do organizador)
    const { data: tournament, error: tournError } = await supabase
      .from("tournaments")
      .select("id, name, entry_fee, organizer_pix_key, owner_id")
      .eq("id", team.tournament_id)
      .maybeSingle();

    if (tournError || !tournament) {
      return NextResponse.json(
        { error: "Torneio vinculado à inscrição não foi encontrado." },
        { status: 404 }
      );
    }

    // 3. Determinar o valor da taxa de inscrição
    let entryFee = Number(tournament.entry_fee || 0);

    // Se a equipe possuir um mp_payment_id e entryFee for 0, consulta valor real no Mercado Pago
    if (entryFee === 0 && team.mp_payment_id && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const mpInfo = await payment.get({ id: String(team.mp_payment_id) });
        if (mpInfo?.transaction_amount) {
          entryFee = Number(mpInfo.transaction_amount);
        }
      } catch (mpErr) {
        console.warn("[Manual Split MVP] Aviso ao consultar detalhes de pagamento no Mercado Pago:", mpErr);
      }
    }

    // 4. Cálculo Matemático: 90% para o organizador e 10% taxa da plataforma
    const amountToTransfer = Math.round(entryFee * 0.90 * 100) / 100;
    const platformFee = Math.round((entryFee - amountToTransfer) * 100) / 100;
    const organizerPixKey = (tournament.organizer_pix_key || "").trim();

    console.log(`[Manual Split MVP] Equipe: ${team.name} (${team.id}) | Torneio: ${tournament.name}`);
    console.log(`[Manual Split MVP] Total: R$ ${entryFee.toFixed(2)} | Repasse 90%: R$ ${amountToTransfer.toFixed(2)} | Taxa 10%: R$ ${platformFee.toFixed(2)} | Chave Pix: ${organizerPixKey || "Não informada"}`);

    // 5. Atualização do Banco de Dados:
    // Bypass da API de Transferência do Mercado Pago (MVP com repasse manual fora do sistema)
    // Atualiza tabela teams com: payment_status: 'PAID', status: 'PAID', payout_status: 'MANUAL_PENDING', payout_amount: amountToTransfer
    const updatePayload: Record<string, any> = {
      status: "PAID",
      payment_status: "PAID",
      payout_status: "MANUAL_PENDING",
      payout_amount: amountToTransfer,
    };

    const { data: updatedTeam, error: updateError } = await supabase
      .from("teams")
      .update(updatePayload)
      .eq("id", team.id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("[Manual Split MVP] Erro ao atualizar status da equipe no banco:", updateError);
      return NextResponse.json(
        { error: "Erro ao atualizar status da equipe no Supabase.", details: updateError.message },
        { status: 500 }
      );
    }

    const message =
      amountToTransfer > 0
        ? `Inscrição confirmada com sucesso! Repasse de R$ ${amountToTransfer.toFixed(2)} (90%) registrado como MANUAL_PENDING para repasse manual.`
        : "Inscrição gratuita confirmada com sucesso!";

    // 6. Retorno de Sucesso (HTTP 200) para atualização imediata da interface
    return NextResponse.json(
      {
        success: true,
        teamId: team.id,
        teamStatus: "PAID",
        paymentStatus: "PAID",
        payoutStatus: "MANUAL_PENDING",
        payout_status: "MANUAL_PENDING",
        amountTransferred: amountToTransfer,
        payoutAmount: amountToTransfer,
        payout_amount: amountToTransfer,
        platformFee,
        organizerPixKey: organizerPixKey ? `${organizerPixKey.slice(0, 4)}***` : null,
        message,
        team: updatedTeam,
      },
      { status: 200 }
    );
  } catch (globalErr: any) {
    console.error("Exceção não tratada na rota /api/manual-split:", globalErr);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar repasse manual.", details: globalErr?.message },
      { status: 500 }
    );
  }
}
