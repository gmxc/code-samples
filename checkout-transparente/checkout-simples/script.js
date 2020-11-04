"use strict";

/** URL base do GmxCheckout. */
const GMXCHECKOUT_BASE_URL = "https://gmxcheckout.com.br";


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

    // Exibir apenas elemento de "loading"
    toggle(true, loadingElem);
    toggle(false, cardErrorElem, cardInvalidTypeElem, errorDataElem, cardInfoOkElem);

    try {
        const data = await getCardData();

        document.getElementById("btn-enviar").disabled = false; 

        if (data.cardType === "credito") {
            cardType.value = "1";
            toggle(true, cardInfoOkElem);
        } else if (data.cardType === "debito") {
            document.getElementById("btn-enviar").disabled = true; 
            toggle(false, cardInfoOkElem);
            toggle(true, cardInvalidTypeElem, errorDataElem);
            cardType.value = "0";
        } else {
            cardType.value = "2";
            toggle(true, cardInfoOkElem);
        }

        bandeiraElem.value = data.provider;

    } catch (e) {
        console.error(e);
        toggle(true, cardErrorElem);
        cardType.value = "2";
    } finally {
        toggle(false, loadingElem);
    }

    refreshInstallmentList();
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
    if (cardType.value !== "0") {
        jQuery('#payment-installments').append(SELECIONE);
        CREDITO.forEach( (creditoOption) => {
            jQuery('#payment-installments').append(creditoOption);
        });        
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