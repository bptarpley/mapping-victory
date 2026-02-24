class Mapper {
    constructor () {
        this.mv = window.mv
        /*
        var CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        });
         */
    }

    pickLocation(regionID, availableLocations=[]) {
        let geoBoundsParams = {
            'page-size': 0,
            'f_regions.id': regionID,
            'a_geobounds_region': 'coordinates'
        }
        callAPI(`${this.mv.api}/Place/`, geoBoundsParams, (geoBoundsData) => {
            console.log(geoBoundsData)
        })
    }
}