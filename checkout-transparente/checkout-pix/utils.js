"use strict";

/**
 * Processa uma variável que pode conter um elemento ou o ID de um elemento.
 * @param {HTMLElement|string} elementOrId Elemento ou ID de um elemento na página.
 * @returns {HTMLElement} Elemento encontrado.
 */
function getElement(elementOrId) {    
    if (typeof elementOrId === "string") {
        return document.getElementById(elementOrId);
    }

    return elementOrId;
}

/**
 * Exibe ou esconde um elemento da página.
 * @param {HTMLElement|string} elementOrId Elemento ou o ID de um elemento na página
 * @param {boolean} visible Se o elemento deve estar visível ou não.
 */
function toggle(elementOrId, visible) {
    getElement(elementOrId).style.display = visible ? "" : "none";
}

/**
 * Exibe um elemento da página.
 * @param {HTMLElement|string} elementOrId Elemento ou o ID de um elemento na página
 */
function show(elementOrId) { toggle(elementOrId, true); }

/**
 * Esconde um elemento da página.
 * @param {HTMLElement|string} elementOrId Elemento ou o ID de um elemento na página
 */
function hide(elementOrId) { toggle(elementOrId, false); }

/**
 * Extrai o valor de um elemento da página em forma de string.
 * @param {HTMLElement|string} elementOrId Elemento ou o ID de um elemento na página
 * @returns {string} Valor que foi extraído.
 */
function extractValue(elementOrId) {
    return String(getElement(elementOrId).value) || '';
}
