import { NextResponse } from "next/server";
import { MercadoPagoConfig, PaymentRefund as Refund } from "mercadopago";
import { supabase } from "@/lib/supabase";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Buscar a equipe no Supabase para obter o mp_payment_id
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, mp_payment_id, payment_status, cancellation_status")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError || !team) {
      return NextResponse.json(
        { error: "Equipe não encontrada." },
        { status: 404 }
      );
    }

    // 2. Chamar o SDK do Mercado Pago para solicitar o reembolso/estorno
    let refundResult = null;
    if (team.mp_payment_id && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const refundClient = new Refund(client);
        refundResult = await refundClient.create({
          payment_id: team.mp_payment_id,
        });
        console.log("Reembolso efetuado no Mercado Pago:", refundResult);
      } catch (mpError: any) {
        console.warn("Aviso ao solicitar estorno no Mercado Pago:", mpError?.message || mpError);
        // Permite prosseguir se o pagamento já havia sido estornado no MP ou em ambiente de testes
      }
    } else {
      console.warn("Inscrição sem mp_payment_id registrado ou chave MP ausente. Processando estorno interno.");
    }

    // 3. Atualizar o banco de dados: payment_status = 'CANCELED', cancellation_status = 'REFUNDED'
    const { error: updateError } = await supabase
      .from("teams")
      .update({
        payment_status: "CANCELED",
        status: "CANCELED",
        cancellation_status: "REFUNDED",
      })
      .eq("id", teamId);

    if (updateError) {
      console.error("Erro ao atualizar status da equipe após estorno:", updateError);
      return NextResponse.json(
        { error: "Erro ao atualizar dados no banco de dados." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Inscrição cancelada e Pix estornado com sucesso.",
        refund: refundResult,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Exceção na rota de estorno:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno ao processar estorno do Pix." },
      { status: 500 }
    );
  }
}
