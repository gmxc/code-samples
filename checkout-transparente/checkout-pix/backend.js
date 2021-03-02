"use strict";

/*

!! ATENÇÃO !!

Todas as funcionalidades incluídas neste script devem estar em seu back-end
e *nunca* devem ser expostas ao cliente via JavaScript.

Elas apenas são implementadas em um script embutido na página de checkout
para fins de exemplo.

*/






/** Endereço base da API Pix do gmxCheckout. */
const BACKEND_BASE_API = "https://pix-api.gmxcheckout.com.br";

/**
 * Caso este valor seja não-null, a função BACKEND_criarCobranca irá sempre retornar
 * este TXID ao invés de criar uma cobrança nova.
 * Pode ser usado para fins de debug da página, utilizando uma cobrança existente
 * com estado conhecido.
 */
const BACKEND_TXID_SIMULADO = null;

/** Gera uma exception se o token da API não foi prenchido. */
function BACKEND_throwIfNoToken() {
    if (!extractValue("api-token")) {
        throw "Insira um token da API";
    }
}

/**
 * Gera cabeçalhos comuns a todas as requisições.
 * @returns {{ [key: string]: string }}
 */
function BACKEND_makeCommonHeaders() {
    return {
        "Authorization": "Bearer " + extractValue("api-token"),
    };
}

/**
 * Um pedido de geração de cobrança ao back-end
 * @typedef Cobranca
 * @property {number} expiracao Tempo de expiração da cobrança, em segundos.
 * @property {string} cpf CPF do devedor, caso seja pessoa física
 * @property {string} cnpj CNPJ do devedor, caso seja pessoa jurídica
 * @property {string} nome Nome ou razão social do devedor
 * @property {string} valor Valor da cobrança. String com ponto (.) como separador de valores decimais.
 * @property {string} solicitacaoPagador Descrição da cobrança
 */

/**
 * Cria uma nova cobrança e retorna o TXID da cobrança.
 * @param {Cobranca} cobranca * 
 * @returns {Promise<string>} String contendo o TXID da cobrança gerada.
 */
async function BACKEND_criarCobranca(cobranca) {

    if (BACKEND_TXID_SIMULADO) {
        return BACKEND_TXID_SIMULADO;
    }

    BACKEND_throwIfNoToken();

    const chave = extractValue("chave-dict");
    if (!chave) {
        throw "Chave DICT obrigatória para a geração de cobranças";
    }

    // Gerar um TXID aleatório
    // Recomenda-se o uso de um UUID/GUID ao invés de um esquema customizado
    // Como a biblioteca padrão do JavaScript não oferece geração de UUIDs,
    // utiliza-se um esquema customizado apenas para fins de exemplo.
    
    const txidBytes = new Uint8Array(17);
    crypto.getRandomValues(txidBytes);

    let txid = "";
    for (const byte of txidBytes) {
        txid += byte.toString(16).padStart(2, '0');
    }

    const body = {
        chave: extractValue("chave-dict"),

        calendario: {
            expiracao: cobranca.expiracao,
        },
        devedor: {
            cpf: cobranca.cpf,
            cnpj: cobranca.cnpj,
            nome: cobranca.nome,
        },
        valor: {
            original: cobranca.valor,
        },
        solicitacaoPagador: cobranca.solicitacaoPagador,
    }

    const url = `${BACKEND_BASE_API}/cob/${txid}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            ...BACKEND_makeCommonHeaders(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw response.status;
    }

    return txid;
}

/**
 * Gera o BR Code de uma cobrança.
 * @param {string} txid TXID da cobrança
 * @param {number} tamanho Tamanho em pixels da imagem a ser gerada.
 * @returns {Promise<Blob>} Dados da imagem contendo o BR Code da cobrança.
 */
async function BACKEND_gerarBrCode(txid, tamanho = 512) {
    BACKEND_throwIfNoToken();

    const url = new URL(`${BACKEND_BASE_API}/cob/${txid}/brcode`);
    url.searchParams.append("tamanho", String(tamanho));

    const response = await fetch(url, {
        method: "GET",
        headers: BACKEND_makeCommonHeaders(),
    });

    if (!response.ok) {
        throw response.status;
    }

    return response.blob();
}

/**
 * Checa se uma cobrança já foi paga ou não.
 * @param {string} txid TXID da cobrança
 * @returns {Promise<boolean>} Se a cobrança já foi paga (true) ou não (false).
 */
async function BACKEND_isCobrancaPaga(txid) {
    BACKEND_throwIfNoToken();

    const url = new URL(`${BACKEND_BASE_API}/cob/${txid}`);
    const response = await fetch(url, {
        method: "GET",
        headers: BACKEND_makeCommonHeaders(),
    });

    if (!response.ok) {
        throw response.status;
    }

    const cob = await response.json();
    return cob.status === "CONCLUIDA";
}
