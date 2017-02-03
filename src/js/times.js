/* Liste des délais entre chaque arrêt */
var timesPerLine = {};

function getTimeLine(lineId, direction) {
    $.getJSON("http://data.metromobilite.fr/api/ficheHoraires/json?route=" + lineId, function (line) {
        var timesArray = [];
        var lastIndex = line[1 - direction].arrets.length - 1;
        timesArray.push({
            delay: 0,
            coord: [line[1 - direction].arrets[lastIndex].lat, line[1 - direction].arrets[lastIndex].lon],
            name: line[1 - direction].arrets[lastIndex].stopName,
            id: line[1 - direction].arrets[lastIndex].stopId
        });

        for (var i = line[1 - direction].arrets.length - 2; i >= 0; i--) {
            if (line[1 - direction].arrets[i].trips[0] == '|') {
                continue;
            }
            var time = line[1 - direction].arrets[lastIndex].trips[0] - line[1 - direction].arrets[i].trips[0];
            var delay = 60;
            if (time != 0) {
                delay = time;
            }
            timesArray.push({
                delay: delay,
                coord: [line[1 - direction].arrets[i].lat, line[1 - direction].arrets[i].lon],
                name: line[1 - direction].arrets[i].stopName,
                id: line[1 - direction].arrets[i].stopId
            });
            lastIndex = i;
        }
        timesPerLine[[lineId, direction]] = timesArray;
        loadTrains(lineId, line[1 - direction].arrets[line[1 - direction].arrets.length - 1].stopId, direction);
    });
}
