"use strict";

/** URL base do GmxCheckout. */
// const GMXCHECKOUT_BASE_URL = "https://gmxcheckout.com.br";
const GMXCHECKOUT_BASE_URL = "http://localhost:9088";

const CIELO_3DS_CONFIG = {
    /**
     * Normalmente, o script de 3DS 2.0 da Cielo seria carregado de forma estática na página, como na tag <script> comentada na pagina HTML,
     * já que seu Access Token estaria em um input hidden populado pelo back-end antes do envio da página ao cliente.
     * 
     * Porém, como nesta página de exemplo o Access Token é inserido manualmente após o carregamento da página, o script de 3DS 2.0
     * da Cielo é carregado dinâmicamente por JavaScript.
     * Isto não é necessário em produção.
     * 
     * Obs: A Cielo recomenda que o script seja servido localmente do mesmo servidor que serve a página de checkout.
     * Utilizamos uma versão não-local apenas para fins de exemplo. 
     */
    scriptUrl: "https://mpisandbox.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js",

    /** 
     * Se o ambiente de sandbox deve ser usado ao invés do ambiente de produção. 
     * Desative isto em produção.
    */
    useSandbox: true,

    /** 
     * Se mensagens de diagnóstico devem ser exibidas no console.
     * Desative isto em produção.
     */
    enableDebug: true
};

/** Estado atual da autenticação 3DS. Alterado durante o ciclo de vida da aplicação. */
const cielo3dsState = {

    /**
     * Status atual do script de 3DS da Cielo.
     * - "none": Não foi carregado ainda
     * - "pending": Foi carregado, mas estamos aguardando sua inicialização
     * - "done": Já foi inicializado com sucesso e pode ser usado sem problemas
     */
    scriptStatus: "none",

    /**
     * Status atual da autenticação 3DS
     * - "none": Sem autenticação
     * - "pending": Autenticação solicitada, mas estamos aguardando seu resultado
     * - "done": Autenticado com sucesso
     */
    authenticationStatus: "none",
};

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

    const modalidadeVendaElem = document.getElementById("gmx-venda-modalidade");
    const vendaBandeiraElem = document.getElementById("gmx-venda-bandeira");
    const bpmpiPaymentMethodElem = document.querySelector(".bpmpi_paymentmethod");

    // Exibir apenas elemento de "loading"
    toggle(true, loadingElem);
    toggle(false, cardTypeElem, cardBandeiraElem, cardErrorElem);

    try {
        const data = await getCardData();

        if (data.cardType === "credito") {
            cardTypeElem.innerText = "Crédito";
            modalidadeVendaElem.value = "1";
        } else if (data.cardType === "debito") {
            cardTypeElem.innerText = "Débito";
            modalidadeVendaElem.value = "0";
        } else {
            // Somente para exemplo, pois existe a possibilidade do cardType ser "multiplo", ou seja, permitir
            // transação como crédito ou débito
            // Nesse caso é interessante criar um radiobutton para o cliente escolher qual a modalidade de sua compra
            cardTypeElem.innerText = "Débito";
            modalidadeVendaElem.value = "0";
        }

        cardBandeiraElem.innerText = data.provider;
        vendaBandeiraElem.value = data.provider;

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

/*
* Normalmente, o script de 3DS 2.0 da Cielo seria carregado de forma estática na página, como na tag <script> comentada na pagina HTML,
* já que seu Access Token estaria em um input hidden populado pelo back-end antes do envio da página ao cliente.
* 
* Porém, como nesta página de exemplo o Access Token é inserido manualmente após o carregamento da página, o script de 3DS 2.0
* da Cielo é carregado dinâmicamente por JavaScript.
* Isto não é necessário em produção.
*/
function load3dsScript() {
    if (cielo3dsState.scriptStatus === "done") {
        // Script já foi inicializado, apenas iniciar autenticação imediatamente        
        // Esta função é criada pelo script 3DS 2.0 da Cielo com este exato nome
        bpmpi_authenticate();
        return;
    }
    
    if (cielo3dsState.scriptStatus === "pending") {
        // Script foi carregado mas não inicializado ainda
        // Quando for inicializado, o script automaticamente chamará bpmpi_authenticate para nós
        // Logo, não há nada a fazer aqui.
        return;
    }

    cielo3dsState.scriptStatus = "pending";
    console.warn("Script 3DS 2.0 será inserido dinâmicamente na página. Isto não é necessário em produção, já que seu Access Token estaria em um input hidden populado pelo back-end antes do envio da página ao cliente.");

    const script = document.createElement("script");
    script.id = "gmx-3ds-script";
    script.addEventListener("load", () => console.log("Script 3DS carregou com sucesso"));
    script.src = CIELO_3DS_CONFIG.scriptUrl;
    document.head.appendChild(script);
}

/** Inicia a autenticação 3DS da Cielo. */
function start3dsAuthentication() {
    if (cielo3dsState.authenticationStatus !== "none") { return; }

    cielo3dsState.authenticationStatus = "pending";
    toggle(true, document.getElementById("gmx-enviar-loading"));
    toggle(false, document.getElementById("gmx-enviar-text"));

    // Script será carregado dinâmicamente na página de teste
    // Em produção, esta chamada pode ser substituída por bpmpi_authenticate() diretamente
    load3dsScript();
}

/**
 * Finaliza a autenticação 3DS com um sucesso.
 * @param data Dados recebidos da Cielo
 */
function end3dsAuthenticationSuccess(data) {
    if (cielo3dsState.authenticationStatus !== "pending") { return; }

    cielo3dsState.authenticationStatus = "done";
    toggle(false, document.getElementById("gmx-enviar-loading"));
    toggle(true, document.getElementById("gmx-enviar-text"));

    document.getElementById("gmx-3ds-cavv").value = data.Cavv;
    document.getElementById("gmx-3ds-xid").value = data.Xid;
    document.getElementById("gmx-3ds-eci").value = data.Eci;
    document.getElementById("gmx-3ds-reference-id").value = data.ReferenceId;

    document.getElementById("gmx-form").submit();
}
/**
 * 
 * Finaliza a autenticação 3DS com um sucesso.
 * @param message Mensagem de erro
 */
function end3dsAuthenticationError(message) {
    if (cielo3dsState.authenticationStatus !== "pending") { return; }

    cielo3dsState.authenticationStatus = "none";
    toggle(false, document.getElementById("gmx-enviar-loading"));
    toggle(true, document.getElementById("gmx-enviar-text"));

    alert("Erro durante autenticação 3DS: " + message);
}


function getFormDataWithout3DS(){

    const vendaModalidade = document.getElementById("gmx-venda-modalidade");
    const vendaValor = document.getElementById("gmx-venda-valor");
    const consumidorNome = document.getElementById("gmx-consumidor-nome");

    const cartaoNumero = document.getElementById("gmx-card-number");
    const cartaoCodigoSeguranca = document.getElementById("gmx-card-codigo-seguranca");
    const cartaoMesValidade = document.getElementById("gmx-card-mes-validade");
    const cartaoAnoValidade = document.getElementById("gmx-card-ano-validade");
    const cartaoBandeira = document.getElementById("gmx-venda-bandeira");
    const restApi = document.getElementById("restApi");
    
    return {
        "transactionToken":  getTransactionToken(),

        "venda.modalidadeVenda":  vendaModalidade ? vendaModalidade.value : "",
        "venda.valor":  vendaValor ? vendaValor.value : "",
        "venda.consumidor.nome":  consumidorNome ? consumidorNome.value : "",

        "cartaoCredito.numero":  cartaoNumero ? cartaoNumero.value : "",
        "cartaoCredito.codSeguranca":  cartaoCodigoSeguranca ? cartaoCodigoSeguranca.value : "",
        "cartaoCredito.mesValidade":  cartaoMesValidade ? cartaoMesValidade.value : "",
        "cartaoCredito.anoValidade":   cartaoAnoValidade ? cartaoAnoValidade.value : "",
        "cartaoCredito.bandeira":  cartaoBandeira ? cartaoBandeira.value : "",
        "restApi":  true
    }
}

// Função para tentativa de venda sem autenticação 3DS, somente efetuada caso a venda seja na modalidade crédito
function tryToBuyWithout3DS(message){
    const MODALIDADE_CARTAO_CREDITO = "1";
    const modalidadeVendaElem = document.getElementById("gmx-venda-modalidade");
    
    if (modalidadeVendaElem.value === MODALIDADE_CARTAO_CREDITO){
        // Busca as informações pertinentes à venda
        const purchaseData = getFormDataWithout3DS();

        // Exemplo de chamada para venda comum, sem 3DS
        // Para tal, nenhum dado de venda 3DS deve ser fornecida 
        $.post(GMXCHECKOUT_BASE_URL + "/txn/post",
        purchaseData,
        function(data,status){
            var docPage = document.open("text/html", "replace");
            docPage.write(data);
            docPage.close();
        });
    } else {
        end3dsAuthenticationError(message);
    }
}


/**
 * Retorna a configuração usada pelo script 3DS 2.0 da Cielo.
 * Esta função é chamada diretamente pelo script da Cielo e deve ter este exato nome.
 * Garanta que a função é definida antes do script da Cielo ser carregado.
 */
const bpmpi_config = () => ({
    Environment: CIELO_3DS_CONFIG.useSandbox ? "SDB" : "PRD",
    Debug: CIELO_3DS_CONFIG.enableDebug,

    // Função executada quando o script terminar sua inicialização, indicando que uma autenticação pode ser realizada
    onReady: () => { 
        console.log("Script 3DS da Cielo finalizou sua inicialização com sucesso");
        cielo3dsState.scriptStatus = "done";

        // Esta função é criada pelo script 3DS 2.0 da Cielo com este exato nome
        bpmpi_authenticate();
    },

    // Função executada quando uma autenticação requisitada ocorreu com sucesso
    onSuccess: e => end3dsAuthenticationSuccess(e),

    // Função executada quando há um erro genérico no sistema 3DS
    onError: e => {
        if (cielo3dsState.scriptStatus !== "done") {
            console.error("Erro ao carregar script 3DS 2.0 da Cielo", e);
            alert("Erro ao carregar script 3DS 2.0 da Cielo. Verifique se seu Access Token está correto.")
            document.getElementById("gmx-3ds-script").remove();
            cielo3dsState.scriptStatus = "none";
        }

        end3dsAuthenticationError("Erro desconhecido");
    },
    
    // Várias funções executadas quando uma autenticação requisitada falhou por diversos motivos
    // Uma opção é capturarmos o erro e redirecionarmos para tentativa de venda sem autenticação 3DS
    onFailure:          () => tryToBuyWithout3DS("Autenticação falhou"),
    onUnenrolled:       () => tryToBuyWithout3DS("Cartão não elegível para autenticação"),
    onDisabled:         () => tryToBuyWithout3DS("Empresa desabilitou autenticação"),
    onUnsupportedBrand: () => tryToBuyWithout3DS("Bandeira não suporta autenticação"),
});

document.addEventListener("DOMContentLoaded", () => {
    // Esta função será executada quando a página terminar de carregar
    // Equivalente ao $.ready do jQuery

    // Atualizar tipo e bandeira do cartão toda vez que o número for alterado
    document.getElementById("gmx-card-number").addEventListener("change", () => refreshCardData());
    // Atualiza tipo e bandeira do cartão após inserção do token de transação
    document.getElementById("gmx-transaction-token").addEventListener("change", () => refreshCardData());
    refreshCardData(); // Atualizar dados do cartão imediatamente após carregamento da página também

    // Interceptar submit do formulário e chamar autenticação 3DS quando o usuário clicar em "Enviar"
    document.getElementById("gmx-form").addEventListener("submit", e => {
        // Se a autenticação 3DS já ocorreu com sucesso, enviar formulário normalmente
        if (cielo3dsState.authenticationStatus === "done") { return; }

        // Impedir envio do formulário e iniciar autenticação 3DS
        e.preventDefault();
        start3dsAuthentication();
    });
});
