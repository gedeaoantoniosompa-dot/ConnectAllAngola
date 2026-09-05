function templateEmail(codigo) {
  return {
    subject: `${codigo} — Código de verificação | ConnectAll Angola`,

    html: `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificação de Email - ConnectAll Angola</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#f4f6f8;
  font-family:Arial, Helvetica, sans-serif;
  color:#1f2937;
">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background-color:#f4f6f8; padding:40px 15px;"
  >
    <tr>
      <td align="center">

        <!-- CONTAINER PRINCIPAL -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:600px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 18px rgba(0,0,0,0.06);
          "
        >

          <!-- CABEÇALHO -->
          <tr>
            <td
              align="center"
              style="
                padding:32px 30px 24px;
                border-bottom:1px solid #eef0f2;
              "
            >

              <img
                src="https://connectallangola.web.app/images/connectall-icon.png"
                alt="ConnectAll Angola"
                width="82"
                height="82"
                style="
                  display:block;
                  width:82px;
                  height:82px;
                  object-fit:contain;
                  margin:0 auto 16px;
                "
              >

              <div style="
                font-size:24px;
                font-weight:700;
                color:#111111;
                line-height:32px;
              ">
                ConnectAll<span style="color:#a8203a;">Angola</span>
              </div>

              <div style="
                margin-top:5px;
                font-size:13px;
                color:#6b7280;
              ">
                Conectando talentos, criando oportunidades
              </div>

            </td>
          </tr>


          <!-- CONTEÚDO -->
          <tr>
            <td style="padding:40px 40px 35px;">

              <div style="
                font-size:26px;
                font-weight:700;
                color:#111827;
                margin-bottom:12px;
              ">
                Confirmar endereço de email
              </div>

              <p style="
                margin:0 0 25px;
                font-size:15px;
                line-height:24px;
                color:#4b5563;
              ">
                Recebemos um pedido para confirmar o teu endereço
                de email na <strong>ConnectAll Angola</strong>.
              </p>

              <p style="
                margin:0 0 18px;
                font-size:15px;
                line-height:24px;
                color:#4b5563;
              ">
                Introduz o código abaixo na aplicação para concluir
                a verificação:
              </p>


              <!-- BLOCO OTP -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:25px 0;"
              >
                <tr>
                  <td
                    align="center"
                    style="
                      background:#f8f9fb;
                      border:1px solid #e5e7eb;
                      border-radius:14px;
                      padding:28px 15px;
                    "
                  >

                    <div style="
                      font-size:12px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                      color:#6b7280;
                      margin-bottom:12px;
                    ">
                      Código de verificação
                    </div>

                    <div style="
                      font-size:38px;
                      font-weight:800;
                      letter-spacing:9px;
                      color:#a8203a;
                      line-height:48px;
                      padding-left:9px;
                    ">
                      ${codigo}
                    </div>

                    <div style="
                      margin-top:12px;
                      font-size:13px;
                      color:#6b7280;
                    ">
                      Válido durante ${TEMPO_EXPIRACAO_MIN} minutos
                    </div>

                  </td>
                </tr>
              </table>


              <!-- AVISO DE SEGURANÇA -->
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  margin:25px 0;
                  background:#fff8e8;
                  border-left:4px solid #e5a900;
                  border-radius:6px;
                "
              >
                <tr>
                  <td style="padding:14px 16px;">

                    <div style="
                      font-size:14px;
                      font-weight:700;
                      color:#5f4500;
                      margin-bottom:5px;
                    ">
                      🔒 Segurança
                    </div>

                    <div style="
                      font-size:13px;
                      line-height:20px;
                      color:#665a38;
                    ">
                      Nunca partilhes este código com outras pessoas.
                      A equipa da ConnectAll Angola nunca irá pedir
                      o teu código de verificação.
                    </div>

                  </td>
                </tr>
              </table>


              <p style="
                margin:25px 0 0;
                font-size:14px;
                line-height:22px;
                color:#6b7280;
              ">
                Se não foste tu a solicitar este código, podes ignorar
                este email. A tua conta permanecerá protegida.
              </p>


              <!-- BOTÃO -->
              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="margin:30px auto 5px;"
              >
                <tr>
                  <td
                    align="center"
                    style="
                      background:#a8203a;
                      border-radius:8px;
                    "
                  >

                    <a
                      href="https://connectallangola.web.app/"
                      target="_blank"
                      style="
                        display:inline-block;
                        padding:14px 28px;
                        font-size:14px;
                        font-weight:700;
                        color:#ffffff;
                        text-decoration:none;
                      "
                    >
                      Aceder à ConnectAll Angola
                    </a>

                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- RODAPÉ -->
          <tr>
            <td
              align="center"
              style="
                background:#fafafa;
                border-top:1px solid #eef0f2;
                padding:25px 30px;
              "
            >

              <div style="
                font-size:13px;
                color:#6b7280;
                margin-bottom:8px;
              ">
                ConnectAll Angola
              </div>

              <div style="
                font-size:12px;
                line-height:19px;
                color:#9ca3af;
              ">
                Conectando talentos, criando oportunidades
              </div>

              <div style="
                margin-top:12px;
                font-size:12px;
              ">
                <a
                  href="https://connectallangola.web.app/"
                  target="_blank"
                  style="
                    color:#a8203a;
                    text-decoration:none;
                  "
                >
                  connectallangola.web.app
                </a>
              </div>

              <div style="
                margin-top:15px;
                font-size:11px;
                color:#b0b5bb;
              ">
                Este é um email automático. Por favor, não respondas
                diretamente a esta mensagem.
              </div>

            </td>
          </tr>

        </table>

        <!-- TEXTO FORA DO CARTÃO -->
        <div style="
          max-width:600px;
          margin:18px auto 0;
          text-align:center;
          font-size:11px;
          line-height:18px;
          color:#9ca3af;
        ">
          © ${new Date().getFullYear()} ConnectAll Angola.
          Todos os direitos reservados.
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
    `,
  };
}