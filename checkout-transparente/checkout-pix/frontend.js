"use strict";

/** Tempo, em segundos, que a página irá aguardar antes de checar se a cobrança já foi paga. */
const COBRANCA_POLLING_SECS = 5;

/** Se uma cobrança já está sendo gerada no momento. */
let gerarCobrancaLoading = false;
/** ID do setInterval usado apra verificar se a cobrança já foi paga. */
let verificarCobrancaPagaIntervalId = null;

/** Gera uma cobrança com base nos dados exibidos na página. */
async function gerarCobranca() {

    const cpfOuCnpj = extractValue("cpf-cnpj");
    const nome = extractValue("nome");
    const valor = extractValue("valor");
    const expiracao = extractValue("expiracao");
    const solicitacaoPagador = extractValue("solicitacao-pagador");

    let cpf = null;
    let cnpj = null;
    if (cpfOuCnpj.length === 11) {
        cpf = cpfOuCnpj;
    } else if (cpfOuCnpj.length === 14) {
        cnpj = cpfOuCnpj;
    } else {
        throw "Campo 'CPF ou CNPJ' deve ter 11 ou 14 números";
    }

    const txid = await BACKEND_criarCobranca({
        expiracao: Number(expiracao),
        cpf,
        cnpj,
        nome,
        valor,
        solicitacaoPagador,
    });

    hide("page-before-cobranca");
    show("page-waiting-cobranca");

    const codigos = await BACKEND_gerarCodigos(txid);
    const dataUrl = `data:${codigos.brCodeContentType};base64,${codigos.brCode}`;

    document.getElementById("qr-code").src = dataUrl;
    document.getElementById("codigo-copia-cola").value = codigos.copiaCola;
    
    hide("qr-code-spinner");
    show("qr-code");
    show("codigo-copia-cola-wrapper");

    // Recomenda-se a utilização de WebSocket ou Server-Sent Events (SSE) 
    // para que a página seja avisada de quando a cobrança foi paga com sucesso
    // Como isto não é possível em uma página HTML estática, utilizamos polling 
    // apenas para fins de exemplo.
    verificarCobrancaPagaIntervalId = setInterval(
        () => verificarCobrancaPaga(txid), 
        COBRANCA_POLLING_SECS * 1000
    );
}

/**
 * Verifica se a cobrança já foi paga.
 * @param {string} txid TXID da cobrança.
 */
async function verificarCobrancaPaga(txid) {

    if (!await BACKEND_isCobrancaPaga(txid)) {
        return;
    }

    clearInterval(verificarCobrancaPagaIntervalId);

    hide("page-waiting-cobranca");
    show("page-after-cobranca");
}


document.getElementById("btn-gerar-cobranca").addEventListener("click", async e => {
    e.preventDefault();

    if (gerarCobrancaLoading) { return; }

    hide("btn-gerar-cobranca-text");
    show("btn-gerar-cobranca-spinner");
    gerarCobrancaLoading = true;

    try {
        await gerarCobranca();

    } catch(e) {
        console.error(e);
        alert(e);

    } finally {        
        show("btn-gerar-cobranca-text");
        hide("btn-gerar-cobranca-spinner");
        gerarCobrancaLoading = false;
    }    
});

let codigoCopiaColaBtnLatestTimeout = null;
document.getElementById("codigo-copia-cola-btn").addEventListener("click", e => {
    e.preventDefault();
    navigator.clipboard.writeText(
        document.getElementById("codigo-copia-cola").value
    );

    e.target.classList.remove('btn-outline-secondary');
    e.target.classList.add('btn-outline-success');
    e.target.innerText = 'Copiado';

    clearTimeout(codigoCopiaColaBtnLatestTimeout);
    codigoCopiaColaBtnLatestTimeout = setTimeout(() => {
        e.target.classList.add('btn-outline-secondary');
        e.target.classList.remove('btn-outline-success');
        e.target.innerText = 'Copiar';
    }, 5000);
});
