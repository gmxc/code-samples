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
    const cardTypeElem = document.getElementById("gmx-card-type");
    const cardBandeiraElem = document.getElementById("gmx-card-bandeira");
    const cardErrorElem = document.getElementById("gmx-card-error");

    const modalidadeVendaElem = document.getElementById("gmx-modalidade-venda");
    const cartaoBandeiraElem = document.getElementById("gmx-cartao-bandeira");

    // Exibir apenas elemento de 'loading'
    toggle(true, loadingElem);
    toggle(false, cardTypeElem, cardBandeiraElem, cardErrorElem);

    try {
        const data = await getCardData();

        if (data.type === "CREDIT") {
            cardTypeElem.innerText = "Crédito";
            modalidadeVendaElem.value = "1";
        } else {
            cardTypeElem.innerText = "Débito";
            modalidadeVendaElem.value = "0";
        }

        cardBandeiraElem.innerText = data.bandeira;
        cartaoBandeiraElem.value = data.bandeira;

        toggle(true, cardTypeElem, cardBandeiraElem);

    } catch (e) {
        console.error(e);
        toggle(true, cardErrorElem);

    } finally {
        toggle(false, loadingElem);
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
    body.append("cartaoCredito.numero", cardNumberElem.value || "");

    const response = await fetch(GMXCHECKOUT_BASE_URL + "/txn/getCardData", {
        method: "POST",
        body
    });

    if (!response.ok) {
        throw new Error("Servidor retornou " + response.status);
    }

    const json = await response.json();
    if (json.status !== "success") {
        throw new Error(json.errorMessage || "Erro desconhecido");
    }

    return json.value;
}

document.addEventListener("DOMContentLoaded", () => {
    // Esta função será executada quando a página terminar de carregar
    // Equivalente ao $.ready do jQuery

    document.getElementById("gmx-card-number").addEventListener("change", () => refreshCardData());
    refreshCardData();
});