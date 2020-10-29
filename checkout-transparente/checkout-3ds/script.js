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
    const cardErrorElem = document.getElementById("gmx-card-error");
    const cardInfoOkElem = document.getElementById("gmx-card-info-ok");

    const modalidadeVendaElem = document.getElementById("gmx-venda-modalidade");
    
    const bandeiraElem = document.getElementById("bandeira");
    const cardType = document.getElementById("cardType");

    // Exibir apenas elemento de "loading"
    toggle(true, loadingElem);
    toggle(false, cardErrorElem, cardInfoOkElem);

    try {
        const data = await getCardData();

        if (data.cardType === "credito") {
            // Utilizada modalidade de venda = 2 (parcelamento pela loja) 
            modalidadeVendaElem.value = "2";
            cardType.value = "1";
        } else if (data.cardType === "debito") {
            modalidadeVendaElem.value = "0";
            cardType.value = "0";
        } else {
            cardType.value = "2";
        }

        bandeiraElem.value = data.provider;

        toggle(true, cardInfoOkElem);

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
 * Atualiza a modalidade da venda - em caso de débito será "0" e se selecionado crédito, indica que o parcelamento será realizado pela loja (2).
 */
function refreshVendaModalidade() {
    const paymentInstallments = document.getElementById("payment-installments");
    const modalidadeVendaElem = document.getElementById("gmx-venda-modalidade");

    if (paymentInstallments.value === ""){
        modalidadeVendaElem.value = "";
        return;
    }

    if (paymentInstallments.value === "0") {
        modalidadeVendaElem.value = "0";
    } else {
        modalidadeVendaElem.value = "2";
    }
}

/**
 * Cria select com lista de opções de pagamento e parcelamento.
 */ 
function refreshInstallmentList() {
    const SELECIONE         = new Option("Selecione"                 ,       ""  );
    const DEBITO            = new Option("Débito"                    ,       "0" );
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
    if (cardType.value === "0") {
        jQuery('#payment-installments').append(DEBITO);
        jQuery('#venda-parcelada').empty();
    } else if (cardType.value === "1"){
        jQuery('#payment-installments').append(SELECIONE);
        CREDITO.forEach( (creditoOption) => {
            jQuery('#payment-installments').append(creditoOption);
        });
    } else {
        jQuery('#payment-installments').append(SELECIONE);
        jQuery('#payment-installments').append(DEBITO);
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
    const paymentInstallments = document.getElementById("payment-installments");
    const consumidorNome = document.getElementById("gmx-consumidor-nome");

    const cartaoNumero = document.getElementById("gmx-card-number");
    const cartaoCodigoSeguranca = document.getElementById("gmx-card-codigo-seguranca");
    const cartaoMesValidade = document.getElementById("gmx-card-mes-validade");
    const cartaoAnoValidade = document.getElementById("gmx-card-ano-validade");
    const cartaoBandeira = document.getElementById("bandeira");
    const restApi = document.getElementById("restApi");
    
    var body = {
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

    if (vendaModalidade && vendaModalidade.value === "2" && paymentInstallments.value !== ""){
        body["venda.parcelas"] = paymentInstallments.value;
    }

    return body;
}

// Função para tentativa de venda sem autenticação 3DS, somente efetuada caso a venda seja na modalidade crédito
function tryToBuyWithout3DS(message){
    const MODALIDADE_CARTAO_CREDITO = "2";
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
    // No caso de falha (onFailure), será exibida a mensagem de erro do 3DS. Esta abordagem é necessária, pois
    // caso o cliente cancele a autenticação, o 3DS retorna este erro, sendo prudente não prosseguir
    // com tentativa de venda sem o 3DS, já que o usuário escolheu pelo cancelamento da transação.
    onFailure:          () => end3dsAuthenticationError("Autenticação falhou"),
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

    // Atualizaa modalidade de venda a depender se débito (0) ou crédito (2 - parcelas por conta da loja)
    document.getElementById("payment-installments").addEventListener("change", () => refreshVendaModalidade());

    refreshCardData(); // Atualizar dados do cartão imediatamente após carregamento da página também

    refreshInstallmentList(); // Insere lista de modalidades de pagamento (débito/crédito e parcelas)

    // Interceptar submit do formulário e chamar autenticação 3DS quando o usuário clicar em "Enviar"
    document.getElementById("gmx-form").addEventListener("submit", e => {
        // Obtém a quantidade de parcelas do select da página - caso seja débito, terá valor ""
        const paymentInstallments = document.getElementById("payment-installments");

        // Obtém o elemento da div de venda-parcelada, em que conterá (crédito) ou não (débito) o campo venda.parcelas
        const parcelasVendaElem = jQuery("#venda-parcelada");
        parcelasVendaElem.empty();

        const vendaModalidade = document.getElementById("gmx-venda-modalidade");
        if (vendaModalidade && vendaModalidade.value === "2" && paymentInstallments.value !== ""){
            parcelasVendaElem.append('<input type="hidden" name="venda.parcelas" value="' + paymentInstallments.value + '" id="gmx-venda-parcelas">')
        }

        // Se a autenticação 3DS já ocorreu com sucesso, enviar formulário normalmente
        if (cielo3dsState.authenticationStatus === "done") { return; }

        // Impedir envio do formulário e iniciar autenticação 3DS
        e.preventDefault();
        start3dsAuthentication();
    });
});
