import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabase } from "@/lib/supabase";

// 1. Configuração do SDK do Mercado Pago V2
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});
const payment = new Payment(client);

export async function POST(request: Request) {
  try {
    // 2. Receber o body da requisição
    const body = await request.json().catch(() => ({}));
    const {
      tournamentId,
      teamId,
      totalAmount,
      teamName,
      email,
    } = body;

    // Validações básicas
    if (!totalAmount || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      return NextResponse.json(
        { error: "totalAmount deve ser um valor numérico positivo." },
        { status: 400 }
      );
    }

    const amount = Number(totalAmount);
    const payerEmail =
      email && typeof email === "string" && email.includes("@")
        ? email.trim()
        : "atleta@sportconnect.com.br";
    const paymentDescription = `Inscrição SportConnect - ${teamName || "Equipe"}`;

    // Verificação da chave de acesso do Mercado Pago
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn(
        "Aviso: MERCADOPAGO_ACCESS_TOKEN não está definido nas variáveis de ambiente (.env.local)."
      );
      return NextResponse.json(
        {
          error:
            "Credenciais do Mercado Pago não configuradas. Adicione MERCADOPAGO_ACCESS_TOKEN no arquivo .env.local.",
        },
        { status: 500 }
      );
    }

    // 3. Chamada da API do Mercado Pago V2 para criação do Pix
    const paymentResponse = await payment.create({
      body: {
        transaction_amount: amount,
        description: paymentDescription,
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
        },
        metadata: {
          team_id: teamId,
          tournament_id: tournamentId,
        },
      },
    });

    // 4. Extrair qr_code_base64 e qr_code (copia e cola)
    const transactionData =
      paymentResponse.point_of_interaction?.transaction_data;
    const qr_code_base64 = transactionData?.qr_code_base64 || "";
    const qr_code = transactionData?.qr_code || "";

    // 5. Capturar o ID da transação do Mercado Pago e atualizar na tabela teams (mp_payment_id)
    const mpPaymentId = paymentResponse.id?.toString();

    if (teamId) {
      try {
        const { error: updateError } = await supabase
          .from("teams")
          .update({
            payment_status: "WAITING_PIX",
            status: "PENDING",
            mp_payment_id: mpPaymentId,
          })
          .eq("id", teamId);

        if (updateError) {
          console.warn(
            "Aviso ao atualizar mp_payment_id e payment_status no Supabase:",
            updateError.message
          );
        }
      } catch (dbErr) {
        console.warn("Exceção ao persistir payment_status no Supabase:", dbErr);
      }
    }

    // 6. Calcular a divisão de 10% da taxa SportConnect
    const platformFee = Math.round(amount * 0.1 * 100) / 100;
    const organizerAmount = Math.round((amount - platformFee) * 100) / 100;

    // 7. Retornar dados em formato JSON com status 200
    return NextResponse.json(
      {
        success: true,
        id: paymentResponse.id,
        paymentId: mpPaymentId,
        mp_payment_id: mpPaymentId,
        status: paymentResponse.status || "WAITING_PIX",
        qr_code_base64,
        qr_code,
        qr_code_copia_e_cola: qr_code,
        qr_code_image_url: qr_code_base64
          ? `data:image/png;base64,${qr_code_base64}`
          : "",
        split: {
          platformFee,
          organizerAmount,
          platformFeePercentage: 10,
        },
        point_of_interaction: paymentResponse.point_of_interaction,
      },
      { status: 200 }
    );
  } catch (error: any) {
    // 8. Bloco try/catch para capturar erros e devolver status 500
    console.error("Erro ao criar pagamento Pix no Mercado Pago:", error);

    const errorMessage =
      error?.message ||
      error?.cause?.description ||
      "O Mercado Pago recusou a criação do pagamento via Pix.";

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.cause || null,
      },
      { status: 500 }
    );
  }
}
