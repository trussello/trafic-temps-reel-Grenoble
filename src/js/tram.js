/* Liste des valeurs de retours des timers de updateRealTime */
var updateRealTimeTimers = {};

/* Liste des valeurs de retours des timers de loadTrain */
var loadTrainTimers = {};

/* Liste des marqueurs affichés */
var markers = {};

function getIcon(lineId){

    var icon = L.icon({
        iconUrl: "src/images/icons/"+lineId.replace("SEM:","")+".png",
        iconSize:     [31, 24], // size of the icon
        iconAnchor:   [15, 12], // point of the icon which will correspond to marker's location
        popupAnchor:  [5, 5] // point from which the popup should open relative to the iconAnchor
    });

    return icon;

}

/* Rajoute les points en fonction de la durée entre chaque arrêt */
function partitionLineBetweenStops(currentLineTimes, jsonLine, points) {
    for (var j = currentLineTimes.length - 1; j >= 1; j--) {
            var pt1 = swapPair(currentLineTimes[j].coord);
            var pt2 = swapPair(currentLineTimes[j - 1].coord);

            /* Portion entre deux arrets */
            var portion = turf.lineSlice(pt2, pt1, jsonLine);
            var dist = turf.lineDistance(portion, 'kilometers');

            /* Rajouts des points en fonction de la vitesse */
            for(var step = 0; step < dist; step += dist / parseFloat(currentLineTimes[j].delay)) {
                var pt = turf.along(portion, step, "kilometers").geometry.coordinates;
                pt = swapPair(pt);
                points.push(L.latLng(pt));
            }
        }
}

function addMarkersForEachTrams(currentLineTimes, cumulativeTimesPerLine, points, lineId, direction) {
    /* On va du terminus vers le début (sens inverse pour le tracé) */
    function createCallback(currentLineTimes, cumulativeTimesPerLine, points, lineId, indexArret, direction) {
        return function (timesForTheStop) {
            /* Recherche les temps pour la ligne donnee car un arret contient les horaires de plusieurs lignes */
            if (timesForTheStop.length == 0) {
                return;
            }
            var j;
            for (j = 0; j < timesForTheStop.length; j++) {
                if (timesForTheStop[j].pattern.id.includes(lineId)) {
                    break;
                }
            }

            var icon = getIcon(lineId);

            for (var indexHoraires = 0; indexHoraires < timesForTheStop[j].times.length; indexHoraires++) {
                var arriveSecondes = secondesBetweenDates(getDateFromMidnight(timesForTheStop[j].times[indexHoraires].realtimeArrival * 1000), new Date());
                if (arriveSecondes > 0 && arriveSecondes <= currentLineTimes[indexArret + 1].delay) {
                    var percentage = 1 - (cumulativeTimesPerLine[indexArret] + arriveSecondes) / points.length;

                    if (percentage >= 0) {
                        var index = Math.floor(percentage * (points.length - 1));
                        var marker = L.marker(points[index], {icon: icon});
                        var data = {
                            percentage: percentage,
                            index: index
                        };
                        var findLayer = false;
                        for (var layerIndex  = 0; layerIndex < activatedLayers.length; layerIndex ++) {
                            if (activatedLayers[layerIndex].code == lineId) {
                                findLayer = true;
                                break;
                            }
                        }
                        if (findLayer) {
                            marker.addTo(mymap);
                            marker.options = data;
                            markers[[lineId, direction]].push(marker);
                        }
                    }
                } else {
                    break;
                }

            }
        };
    }
    for (var indexArret = 0; indexArret < currentLineTimes.length - 1; indexArret++) {
        $.getJSON("http://data.metromobilite.fr/api/routers/default/index/stops/" + currentLineTimes[indexArret].id + "/stoptimes",
            createCallback(currentLineTimes, cumulativeTimesPerLine, points, lineId, indexArret, direction));
    }
}

/* Calcul les temps cumulés depuis le terminus */
function calculCumulativeTimes(currentLineTimes) {
    cumulativeTimesPerLine = [0];

    for (var k = 1; k < currentLineTimes.length; k++) {
        var precTime = cumulativeTimesPerLine[cumulativeTimesPerLine.length - 1];
        cumulativeTimesPerLine.push(currentLineTimes[k].delay + precTime);
    }
    return cumulativeTimesPerLine;
}

/* Recupère la position exacte du tram toutes les 90 secondes et approxime sa position en temps réel */
function loadTrains(lineId, id, direction) {

    /* Supprime les anciens marqueurs pour afficher les nouveaux */
    if (markers[[lineId, direction]] != undefined) {
        for (var i = 0; i < markers[[lineId, direction]].length; i++) {
            mymap.removeLayer(markers[[lineId, direction]][i]);
        }
    }
    markers[[lineId, direction]] = [];

    /* Recupere les durees entre chaque arret */
    var currentLineTimes = timesPerLine[[lineId, direction]];

    /* Utile juste pour recuperer la polyline qui a un id avec underscore */
    var lineIdWithUnderscore = lineId.replace(":", "_");

    /* Recupere les points de la ligne donnee */
    currentLinePolyLine = tablines[lineIdWithUnderscore];

    /* Liste des points répartis en fonction de la vitesse */
    var points = [];

    /* Partitionnement de la ligne */
    var jsonLine = currentLinePolyLine.toGeoJSON();
    var currentLinesPoints = currentLinePolyLine._latlngs;

    /* Reverse la ligne en fonction de la direction du tram */
    if (L.latLng(currentLineTimes[0].coord).distanceTo(currentLinesPoints[0]) <
            L.latLng(currentLineTimes[0].coord).distanceTo(currentLinesPoints[currentLinesPoints.length - 1])) {
        jsonLine.geometry.coordinates.reverse();
    }

    partitionLineBetweenStops(currentLineTimes, jsonLine, points);

    var cumulativeTimesPerLine = calculCumulativeTimes(currentLineTimes);

    addMarkersForEachTrams(currentLineTimes, cumulativeTimesPerLine, points, lineId, direction);

    var refreshRate = 1000;
    if (updateRealTimeTimers[[lineId, direction]] != undefined)
        clearTimeout(updateRealTimeTimers[[lineId, direction]]);

    updateRealTimeTimers[[lineId, direction]] = updateRealTime(points, refreshRate, lineId, direction);
    loadTrainTimers[[lineId, direction]] = setTimeout(loadTrains, 60000, lineId, id, direction);
}

function updateRealTime(points, refreshRate, lineId, direction) {
    for (var i = 0; i < markers[[lineId, direction]].length; i++) {
        markers[[lineId, direction]][i].options.index = Math.min(markers[[lineId, direction]][i].options.index + 1, points.length - 1) ;
        markers[[lineId, direction]][i].setLatLng(points[markers[[lineId, direction]][i].options.index]);
    }
    updateRealTimeTimers[[lineId,direction]] = setTimeout(updateRealTime, refreshRate, points, refreshRate, lineId, direction);
}