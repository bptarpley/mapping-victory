class Mapper {
    constructor () {
        this.mv = window.mv
        this.map = null
        this.markerCluster = null
    }

    pickLocation(mapDiv, regionID, placesToPlot=[]) {
        let geoBoundsParams = {
            'page-size': 0,
            'f_regions.id': regionID,
            'a_geobounds_region': 'coordinates'
        }

        callAPI(`${this.mv.api}/Place/`, geoBoundsParams, (geoBoundsData) => {
            let boundingBox = geoBoundsData.meta?.aggregations?.region
            if (boundingBox) {
                if (this.map !== null) this.map.remove()
                this.map = L.map(mapDiv)
                L.tileLayer(
                    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                    {
                        maxZoom: 19,
                        noWrap: true
                    }
                ).addTo(this.map)
                this.map.fitBounds([
                    [boundingBox.top_left.lat, boundingBox.top_left.lon],
                    [boundingBox.bottom_right.lat, boundingBox.bottom_right.lon]
                ], {padding: [20, 20]})

                if (this.markerCluster !== null) this.markerCluster.remove()
                this.markerCluster = L.markerClusterGroup({
                    iconCreateFunction: cluster => {
                        let size = cluster.getChildCount()
                        return L.divIcon({
                            className: 'place-cluster',
                            html: `
                                <svg height="50" width="50">
                                    <circle
                                        class="place-marker-circle"
                                        cx="25"
                                        cy="25"
                                        r="24"
                                        fill="#4D82A1"
                                        stroke="#ECEDE4"
                                        stroke-width="1" />
                                    <text
                                        x="${size > 9 ? 17 : 22}"
                                        y="25"
                                        stroke="#ECEDE4"
                                        stroke-width="1"
                                        dy=".3em">
                                        ${size}  
                                    </text>
                                </svg>
                            `
                        })
                    },
                    maxClusterRadius: 60
                })

                placesToPlot.forEach(place => {
                    if (place.coordinates) {
                        let marker = new L.Marker(
                            [place.coordinates[1], place.coordinates[0]],
                            {
                                icon: new L.DivIcon({
                                    className: 'place-marker',
                                    iconSize: [100, 20],
                                    iconAnchor: [0, 0],
                                    html: `
                                        <svg height="20" width="20">
                                            <circle
                                                class="place-marker-circle"
                                                cx="10"
                                                cy="10"
                                                r="8"
                                                fill="#F39931"
                                                stroke="#F39931"
                                                stroke-width="1" />
                                        </svg>
                                        <span class="place-marker-label">
                                            ${place.name}
                                        </span>
                                    `
                                })
                            }
                        )

                        marker.on('click', () => {
                            window.location.href = `?Place=${place.id}`
                        })
                        this.markerCluster.addLayer(marker)
                    }
                })

                this.map.addLayer(this.markerCluster)
            }
        })
    }
}