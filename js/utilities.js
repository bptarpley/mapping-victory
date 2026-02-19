// for getting/manipulating DOM
function getEl(id) { return document.getElementById(id) }
function getElWithQuery(query) { return document.querySelector(query) }
function getElsWithQuery(query) { return document.querySelectorAll(query) }
function forElsMatching(query, callback) { [].forEach.call(document.querySelectorAll(query), callback) }
function clearEl(el) { while (el.firstChild) el.removeChild(el.firstChild) }
function appendToEl(el, html) {
    el.append(htmlToEl(html))
}
function prependToEl(el, html) {
    el.prepend(htmlToEl(html))
}
function htmlToEl(html) {
    let docFrag = document.createDocumentFragment()
    let range = document.createRange()
    range.setStart(docFrag, 0)
    docFrag.appendChild(range.createContextualFragment(html))
    return docFrag
}
function getCssVar(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${variableName}`)
}
function setCssVar(variableName, value) {
    document.documentElement.style.setProperty(variableName, value)
}

// basic utility functions
function callAPI(url, params={}, callback) {
    let fetchURL = url
    if (Object.keys(params).length) {
        fetchURL += '?'
        let paramStrings = []
        for (let param in params) {
            paramStrings.push(`${param}=${params[param]}`)
        }
        fetchURL += paramStrings.join('&')
    }
    fetch(fetchURL)
        .then(res => res.json())
        .then(data => callback(data))
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function romanize (num) {
    if (isNaN(num))
        return num;
    let digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
            "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
            "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}
function hasProp(obj, path) {
    return path.split(".").every(function(x) {
        if(typeof obj != "object" || obj === null || ! x in obj)
            return false
        obj = obj[x]
        return true
    })
}
function delayedScroll(anchor, smooth=true, parent=null) {
    let scrollOpts = {behavior: 'smooth'}
    if (!smooth) scrollOpts = null

    let idSelectedEl = getElWithQuery(`${parent ? '#' + parent + ' ' : ''}#${anchor}`)
    if (idSelectedEl) idSelectedEl.scrollIntoView(scrollOpts)
    else {
        let anchorSelectedEl = getElWithQuery(`${parent ? '#' + parent + ' ' : ''}a[name=${anchor}]`)
        if (anchorSelectedEl) anchorSelectedEl.scrollIntoView(scrollOpts)
    }
}
