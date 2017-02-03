var tablines = {};
var ZOOM_PROCHE = 17;
var ZOOM_LIBELLE = 17;
var ZOOM_LOINTAIN = 13;

//Layers
var linesLayers = [];
var aggregatedStopLayers = new L.LayerGroup();
var stopPointLayers = new L.LayerGroup();
//Control layers
var overlayers = {};
var activatedLayers = [];
var activatedLayersCounter = 0;
var controlLayer;


/**
 * LeafletMap
 */
var mymap;



function createMap() {
    //Chargement de la carte
    loadMap();
    controlLayer = L.control.layers(null, overlayers).addTo(mymap);

    //Ajout du layer par défaut à la carte (les arrêts aggrégés)
    aggregatedStopLayers.addTo(mymap);

    loadStops("arret", aggregatedStopLayers);
    loadStops("pointArret", stopPointLayers);

    loadLines();

    initTriggers();

}

/**
 * Init all triggers
 */
function initTriggers() {
    mymap.on('zoomend', onZoomEnd);

    mymap.on("overlayadd", onOverlayAdd);

    mymap.on("overlayremove", onOverlayRemove);
}

function loadMap() {
    mymap = L.map('mapid').setView([45.1819729, 5.734823, 17], 13);
    var tileLayer = L.tileLayer( 'https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> </br>'
        + 'Networks Data &copy; <a href="http://www.metromobilite.fr/pages/OpenData.html">MétroMobilité</a>, <a href="https://opendatacommons.org/licenses/odbl/">OBdl</a>',
        maxZoom: 18,
    });
    tileLayer.addTo(mymap);
}

function loadLines() {
    $.getJSON("http://data.metromobilite.fr/api/lines/json?types=ligne&reseaux=SEM", function (listLines) {
        for (var i = 0; i < listLines.features.length; i++) {
            loadLine(listLines.features[i]);
        }
    });
}

/**
 * Load a line
 * @param line
 */
function loadLine(feature) {
    //On créé un layer pour la ligne qu'on rajoute aux control layer
    var lineLayer = new L.LayerGroup();
    lineLayer.code = feature.properties.CODE.replace("_", ":");
    lineLayer.numero = feature.properties.NUMERO;
    linesLayers.push(lineLayer);
    var layerName = getIconUrlFromFeature(feature);

    //Ajout du nouveau layer au layerControl
    controlLayer.addOverlay(lineLayer, layerName);

    var object = {
        points: feature.geometry.coordinates,
        couleur: rgbToHex(feature.properties.COULEUR),
        id: feature.properties.CODE
    };

    //Ajout des objets polylines au layer de map + au layer activable
    for (i = 0; i < object.points.length; i++) {
        object.points[i] = swapPair2D(object.points[i]);
        lineLayer.addLayer(L.polyline(object.points[i], {color: object.couleur, weight: 8}));
        var line = L.polyline(object.points[i], {color: object.couleur});
        line.addTo(mymap);
        tablines[object.id] = line;
    }

    //Chargement des arrêts sur une ligne pour le layer activable
    var request = "http://data.metromobilite.fr/api/points/json?types=arret&codes=" + feature.properties.ZONES_ARRET.join();
    $.getJSON(request, function (listStops) {
        for (var i = 0; i < listStops.features.length; i++) {
            loadStop(listStops.features[i], true, lineLayer, 'black', '#000000', 1, 7, true);
        }
    });

}

/**
 *
 * @param type true si les points doivent être aggrégés, false sinon
 * @param layer le layer auquel doivent être ajoutés les points.
 */
function loadStops(type, layer) {
    var yMax = "45.286626";
    var yMin = "44.961890";
    var xMax = "5.855906";
    var xMin = "5.581286";
    var request = "http://data.metromobilite.fr/api/bbox/json?ymax=" + yMax + "&xmin=" + xMin + "&ymin=" + yMin + "&xmax=" + xMax + "&types=" + type;

    $.ajax({
        url: request,
        dataType: 'json',
        async: false,
        success: function (listStops) {
            for (var i = 0; i < listStops.features.length; i++) {
                if (isPartOfSemitagNetwork(listStops.features[i])) {
                    loadStop(listStops.features[i], layer == aggregatedStopLayers, layer);
                }
            }
        }
    });
}

/**
 *
 * @param stop feature concerning the spot point
 * @param aggregatedPoint if it is an aggregated point
 * @param layer the layer where the point has to be added
 * @param color
 * @param fillColor
 * @param fillOpacity
 * @param radius
 * @param bind_label if a label must be binded
 */
function loadStop(stop, aggregatedPoint, layer, color = 'black', fillColor = '#000000', fillOpacity = 0.5, radius = 4, bind_label = false) {

    var stopID = stop.properties.id.replace("_", ":");
    if (aggregatedPoint) {
        stopID = stop.properties.CODE.replace("_", ":");
    }

    var data = {
        stopCoordinates: stop.geometry.coordinates,
        stopName: stop.properties.LIBELLE,
        stopId: stopID,
        aggregatedPoint: aggregatedPoint
    };

    data.stopCoordinates = swapPair(data.stopCoordinates);
    var stopMarker = L.circleMarker(data.stopCoordinates, {
        color: color,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        radius: radius
    });

    if (bind_label)
        stopMarker.bindTooltip(data.stopName, {permanent: true, className: "stopLabel", offset: [0, 0]});

    layer.addLayer(stopMarker);
    stopMarker.data = data;
    stopMarker.on('click', onMarkerClick);
}

//region onMarkerClick
function onMarkerClick(e) {
    e.target.unbindPopup();
    nextArrivals(e.target);
}

function nextArrivals(marker) {
    var data = marker.data;

    var request = "http://data.metromobilite.fr/api/routers/default/index/";
    request += data.aggregatedPoint ? "clusters" : "stops";
    request += "/" + data.stopId + "/stoptimes";

    $.getJSON(request, function (nextTimes) {
        var nextArrivals = {};
        if (nextTimes.length > 0) {
            for (var i in nextTimes) {
                if (nextTimes[i].pattern.id.search("SEM:") == 0) {
                    var line = nextTimes[i].pattern.id.replace("SEM:", "").split(":");
                    line.push(nextTimes[i].pattern.desc)
                    console.log(line);
                    var arrivalsPerLine = [];
                    for (var j = 0; j < Math.min(2, nextTimes[i].times.length); j++) {
                        var arriveAt = new Date((nextTimes[i].times[j].serviceDay + nextTimes[i].times[j].realtimeArrival) * 1000);
                        var diffMinutes = minutesBetweenDates(arriveAt, new Date());
                        if (diffMinutes >= 0)
                            arrivalsPerLine.push(minutesBetweenDates(arriveAt, new Date()));
                    }
                    nextArrivals[line] = arrivalsPerLine;
                }
            }
        }
        data["nextArrivals"] = nextArrivals;
        loadPopupStop(data, marker);
        marker.openPopup();
    });
}

/**
 *
 * @param data Map qui associe à un string, une liste des horaires d'arrivee
 * @param marker marker sur lequel bind le popup
 */
function loadPopupStop(data, marker) {
    var toBeDisplayed = ""; //Text that will be in the popup

    if (Object.keys(data.nextArrivals).length > 0) {
        toBeDisplayed += "<dt>Prochaines arrivées:</dt>";
        for (var key in data.nextArrivals) {

            var filename = "";
            var destination = "";
            if (key.split(",").length == 4) { //Pour un transisere
                filename = key.split(",")[0] + "_" + key.split(",")[1];
                destination = key.split(",")[3];
            } else { //Pour un bus normal
                filename = key.split(",")[0];
                destination = key.split(",")[2];
            }

            toBeDisplayed += "<dt><img src=src/images/icons/" + filename + ".png>" + destination + "</dt>";
            console.log("<img src=src/images/icons/" + key.split(",")[0] + ".png>");

            //On ajoute les différents temps d'arrets que l'on possède
            for (var i = 0; i < data.nextArrivals[key].length && i < 2; i++) {
                var time = Math.floor(data.nextArrivals[key][i]);
                if (time > 60) { //More than one hour
                    var newDateObj = new Date(new Date().getTime() + time * 60000);
                    var s = ('0' + newDateObj.getHours()).slice(-2) + ':'
                        + ('0' + (newDateObj.getMinutes())).slice(-2);

                    toBeDisplayed += "<dt> " + s + "</dt>";
                } else {
                    toBeDisplayed += "<dt> " + Math.floor(data.nextArrivals[key][i]) + " minutes </dt>";
                }
            }
        }

        marker.bindPopup("<dl><dt><b>" + data.stopName + "</b></dt>\n" + "\n" + toBeDisplayed + "</dl>",
            {
                width: "300",
                maxWidth: "300",
                maxHeight: "500"
            });
    }

}
//endregion