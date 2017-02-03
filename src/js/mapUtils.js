/**
 * Change the opacity of myCSSClass according to zoom
 */
function defineTooltipCssOnZoom() {
    var zoomLev = mymap.getZoom();
    //Au dessus (plus loin) de ZOOM_LIBELLE
    if (zoomLev < ZOOM_LIBELLE) {
        $('.stopLabel').css({
            'background': 'rgba(255, 255, 255, 0.0)',
            'border': '2px rgba(0, 0, 255, 0)',
            'opacity': '0'
        });
    }

    //ZOOM proche
    if (zoomLev >= ZOOM_LIBELLE) {
        $('.stopLabel').css({
            'background': 'rgba(255, 255, 255, 0.75)',
            'border': '2px rgba(0, 0, 255, 0)',
            'opacity': '1'
        });
    }
}
/**
 * Trigger on zoom end change (aggregated) points and define css of libelle if there are activated layers
 */
function onZoomEnd() {
    zoomLev = mymap.getZoom();
    if (activatedLayersCounter != 0) {
        defineTooltipCssOnZoom();
    }
    else {
        //Dezoom and display aggregated instead of points
        if (zoomLev < ZOOM_PROCHE && zoomLev > ZOOM_LOINTAIN) {
            mymap.removeLayer(stopPointLayers);
            mymap.addLayer(aggregatedStopLayers);
        } else {
            //Zoom and display points
            if (zoomLev >= ZOOM_PROCHE) {
                mymap.removeLayer(aggregatedStopLayers);
                mymap.addLayer(stopPointLayers);
                //On enlève les sélections de ligne
                for (var i = 0; i < linesLayers.length; i++) {
                    mymap.removeLayer(linesLayers[i]);
                }
            } else {
                if (zoomLev <= ZOOM_LOINTAIN) {
                    mymap.removeLayer(aggregatedStopLayers);
                }
            }
        }
    }
}

/**
 * When a layer is added we add it to the list
 * Css style and actives layers are refreshed
 * @param e
 */
function onOverlayAdd(e) {
    console.log("Overlay added " + e.name)
    activatedLayersCounter++;
    activatedLayers.push(e.layer);
    if (activatedLayersCounter == 1) {
        mymap.removeLayer(aggregatedStopLayers);
        mymap.removeLayer(stopPointLayers);
    }

    defineTooltipCssOnZoom();

    console.log($('label').has('input[type=checkbox]:checked'));
    $('label').has('input[type=checkbox]:checked').find("img").css('transform', 'rotate(360deg)');
    $('label').has('input[type=checkbox]:checked').find("img").css("filter", "drop-shadow(0px 0px 4px black)");

    //Debute l'affichage des trams
    getTimeLine(e.layer.code, 0);
    getTimeLine(e.layer.code, 1);
}

/**
 * When a layer is removed, we remove it from the list
 * Actives layers are refreshed
 * @param e
 */
function onOverlayRemove(e) {
    console.log("Overlay removed " + e.name)
    activatedLayersCounter--;
    var zoomLev = mymap.getZoom();

    //On enleve du tableau
    var index = activatedLayers.indexOf(e.layer);
    if (index > -1) {
        activatedLayers.splice(index, 1);
    }

    //On ajoute le layer de base correspondant
    if (activatedLayersCounter == 0) {
        if (zoomLev < ZOOM_PROCHE && zoomLev >= ZOOM_LOINTAIN) {
            mymap.addLayer(aggregatedStopLayers);
        } else {
            if (zoomLev >= ZOOM_PROCHE) { //Cas le plus proche
                mymap.addLayer(stopPointLayers);
            }
        }
    }

    //On arrete la maj des trams
    clearTimeout(updateRealTimeTimers[[e.layer.code, 0]]);
    clearTimeout(updateRealTimeTimers[[e.layer.code, 1]]);

    clearTimeout(loadTrainTimers[[e.layer.code, 0]]);
    clearTimeout(loadTrainTimers[[e.layer.code, 1]]);


    //On retire les markers des trams
    removeTramMarker(e,0);
    removeTramMarker(e,1);

    //CSS animation des icones
    $('label').has('input[type=checkbox]:not(:checked)').find("img").css('transform', 'rotate(0deg)');
    $('label').has('input[type=checkbox]:not(:checked)').find("img").css("filter", "");

}

/**
 * Remove all marker in a direction for a tram
 * @param e
 * @param direction
 */
function removeTramMarker(e,direction) {
    for (var i = 0; i < markers[[e.layer.code, direction]].length; i++) {
        mymap.removeLayer(markers[[e.layer.code, direction]][i]);
    }
    markers[[e.layer.code, direction]] = [];
}