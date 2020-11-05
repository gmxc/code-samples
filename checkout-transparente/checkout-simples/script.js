"use strict";

/** URL base do GmxCheckout. */
const GMXCHECKOUT_BASE_URL = "https://www.gmxcheckout.com.br";


/** Constante que definirá se as opções de parcelamento deverão ou não (true ou false, respectivamente)
 *  ser exibidas quando o cartão fornecido for emitidos no exterior (informação do BIN do cartão).
 *  Seu uso visa possibilitar o teste de parcelamento em cartões emitidos no exterior, normalmente
 *  bloqueado pelas adquirentes CIELO e REDE.
 *  DEFAULT = false
 */
const EXIBE_OPCOES_PARCELAMENTO_CARTAO_EMITIDO_EXTERIOR = false;

/** 
 * Função utilitária que exibe ou esconde um elemento.
 * @param state Novo estado do elemento: true = visível, false = invisível
 * @param elems Elementos a serem exibidos/escondidos
 */
function toggle(state, ...elems) {
    for (const elem of elems) {
        elem.style.display = state ? "" : "none";
    }
}

/** Busca o token de transação do formulário. */
function getTransactionToken() {
    const elem = document.getElementById("gmx-transaction-token");
    if (!elem) { return ""; }
    return elem.value || "";
}

/** Atualiza os dados do cartão. Deve ser chamado após o número do cartão ser alterado pelo usuário. */
async function refreshCardData() {
    const loadingElem = document.getElementById("gmx-card-loading");
    const cardErrorElem = document.getElementById("gmx-card-error");
    const cardInvalidTypeElem = document.getElementById("gmx-card-invalid-type");
    const cardInfoOkElem = document.getElementById("gmx-card-info-ok");
    const errorDataElem = document.getElementById('error-data');

    const bandeiraElem = document.getElementById("bandeira");
    const cardType = document.getElementById("cardType");
    const foreignCard = document.getElementById("foreignCard");

    const paymentInstallmentsElem = document.getElementById("payment-installments");

    const btnEnviarElem = document.getElementById("btn-enviar");

    // Exibir apenas elemento de "loading"
    toggle(true, loadingElem);
    toggle(false, cardErrorElem, cardInvalidTypeElem, errorDataElem, cardInfoOkElem);

    // Desabilita a caixa de seleção de opções de pagamento e a caixa de seleção da bandeira até que os dados do cartão tenham sido buscados
    paymentInstallmentsElem.disabled = true;
    bandeiraElem.disabled = true;

    // Garante que o botão de envio da transação esteja habilitado,pois ele poderá ser desabilitado caso
    // o cartão fornecido seja de débito, sem função crédito
    btnEnviarElem.disabled = false; 

    try {
        const data = await getCardData();

        if (data.cardType === "credito") {
            cardType.value = "1";
            toggle(true, cardInfoOkElem);
        } else if (data.cardType === "debito") {
            // Desabilita o botão de envio da transação caso o cartão seja apenas de débito
            btnEnviarElem.disabled = true;

            toggle(false, cardInfoOkElem);
            toggle(true, cardInvalidTypeElem, errorDataElem);
            cardType.value = "0";
        } else {
            cardType.value = "2";
            toggle(true, cardInfoOkElem);
        }

        bandeiraElem.value = data.provider;
        foreignCard.value = data.foreignCard;

    } catch (e) {
        console.error(e);
        toggle(true, cardErrorElem);
        cardType.value = "2";
        foreignCard.value = "false";
    } finally {
        toggle(false, loadingElem);
    }

    refreshInstallmentList();

    // Habilita a caixa de seleção de opções de pagamento e a caixa de seleção da bandeira após busca dos dados do cartão e atualização da lista de opções de pagamento
    paymentInstallmentsElem.disabled = false;
    bandeiraElem.disabled = false;    
}

/**
 * Cria select com lista de opções de pagamento e parcelamento.
 */ 
function refreshInstallmentList() {
    const SELECIONE         = new Option("Selecione"                 ,       ""  );
    const CREDITO_1x        = new Option("Crédito - parcela única"   ,       "1" );
    const CREDITO_2x        = new Option("Crédito - parcelada em 2x" ,       "2" );
    const CREDITO_3x        = new Option("Crédito - parcelada em 3x" ,       "3" );
    const CREDITO_4x        = new Option("Crédito - parcelada em 4x" ,       "4" );
    const CREDITO_5x        = new Option("Crédito - parcelada em 5x" ,       "5" );
    const CREDITO_6x        = new Option("Crédito - parcelada em 6x" ,       "6" );
    const CREDITO_7x        = new Option("Crédito - parcelada em 7x" ,       "7" );
    const CREDITO_8x        = new Option("Crédito - parcelada em 8x" ,       "8" );
    const CREDITO_9x        = new Option("Crédito - parcelada em 9x" ,       "9" );
    const CREDITO_10x       = new Option("Crédito - parcelada em 10x",       "10");
    const CREDITO_11x       = new Option("Crédito - parcelada em 11x",       "11");
    const CREDITO_12x       = new Option("Crédito - parcelada em 12x",       "12");

    const CREDITO = [ CREDITO_1x, CREDITO_2x, CREDITO_3x, CREDITO_4x, CREDITO_5x, CREDITO_6x, CREDITO_7x,
                        CREDITO_8x, CREDITO_9x, CREDITO_10x, CREDITO_11x, CREDITO_12x ];

    const cardType = document.getElementById("cardType");
    jQuery('#payment-installments').empty();

    // Somente cartões de crédito ou do tipo múltiplo (também com função crédito) permitidos
    if (cardType.value !== "0") {
        // Caso a constante EXIBE_OPCOES_PARCELAMENTO_CARTAO_EMITIDO_EXTERIOR for falsa e o cartão fornecido seja emitido no exterior,
        // insere apenas a opção de pagamento sem parcelamento (restrição da CIELO e da REDE)
        // Caso contrário insere as opções de parcelamento
        if (!EXIBE_OPCOES_PARCELAMENTO_CARTAO_EMITIDO_EXTERIOR && foreignCard.value === "true") {
            jQuery('#payment-installments').append(CREDITO_1x);
        } else {
            jQuery('#payment-installments').append(SELECIONE);
            CREDITO.forEach( (creditoOption) => {
                jQuery('#payment-installments').append(creditoOption);
            });
        }
    }
}

/**
 * Busca dados do cartão de crédito no gmxCheckout.
 * @throws Gera um erro quando a requisição não foi realizada com sucesso
 * @returns Dados do cartão obtidos do gmxCheckout.
 */
async function getCardData() {
    
    const cardNumberElem = document.getElementById("gmx-card-number");

    // Preparar dados que serão enviados ao gmxCheckout
    const body = new URLSearchParams();
    body.append("transactionToken", getTransactionToken());
    body.append("bin", cardNumberElem.value || "");

    const response = await fetch(GMXCHECKOUT_BASE_URL + "/api/consultaCartaoBin", {
        method: "POST",
        body
    });

    if (!response.ok) {
        throw new Error("Servidor retornou " + response.status);
    }

    const json = await response.json();
    if (json.status !== "00") {
        throw new Error(json.errorMessage || "Erro desconhecido");
    }

    return json;
}

document.addEventListener("DOMContentLoaded", () => {
    // Esta função será executada quando a página terminar de carregar
    // Equivalente ao $.ready do jQuery

    document.getElementById("gmx-card-number").addEventListener("change", () => refreshCardData());

    // Atualiza tipo e bandeira docartão após inserção do token de transação
    document.getElementById("gmx-transaction-token").addEventListener("change", () => refreshCardData());

    refreshCardData(); // Atualizar dados do cartão imediatamente após carregamento da página também
});