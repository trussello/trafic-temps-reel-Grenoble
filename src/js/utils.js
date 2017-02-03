function swapPair2D(tab) {
    var newtab = [];
    for (var i = 0; i < tab.length; i++) {
        newtab.push(swapPair(tab[i]));
    }
    return newtab;
}

function swapPair(tab) {
    return [tab[1], tab[0]];

}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}


function rgbToHex(rgbString) {
    var listeRGB=rgbString.split(",");
    var r = parseInt(listeRGB[0]);
    var g = parseInt(listeRGB[1]);
    var b = parseInt(listeRGB[2]);
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function minutesBetweenDates(date1, date2) {
    return ((date1.getTime() - date2.getTime()) / 1000 ) / 60;
}

function secondesBetweenDates(date1, date2) {
    return (date1.getTime() - date2.getTime()) / 1000;
}

function getDateFromMidnight(delay) {
    var d = new Date();
    d.setHours(0,0,0,0);
    return new Date(d.getTime() + delay);
}

function addLatLng(p1, p2) {
    return new L.latLng([p1.lat + p2.lat, p1.lng + p2.lng]);
}

function mulLatLng(p, coeff) {
    return new L.latLng([p.lat * coeff, p.lng * coeff]);
}

function getIconUrlFromFeature(feature) {
    return getIconUrlFromNumero(feature.properties.NUMERO);
}

function getIconUrlFromCode(code) {
    return getIconUrlFromNumero(code.split(":")[1]);
}

function getIconUrlFromNumero(numero) {
    return "<img src='src/images/icons/" + numero + ".png'>";
}

function isPartOfSemitagNetwork(feature) {
    return feature.properties.CODE.search("SEM_") == 0;
}