class Detailer {
    constructor(parentQuery) {
        this.mv = window.mv
        this.parentEl = getElWithQuery(parentQuery)
        this.modal = null
        this.dragon = null

        this.modalTemplate = `
            <div id="feature-detail-modal" class="hidden">
                <div id="feature-detail-controls">
                    <button id="feature-detail-close-button" class="icon-button" aria-label="Close">
                        <svg width="20" height="20"><use href="#icon-close"/></svg>
                    </button>
                </div>
                <div id="feature-detail-content">
                    <div id="feature-detail-meta-pane"></div>
                    <div id="feature-detail-dragon-pane"></div>
                </div>
            </div>
        `

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal !== null) hideEl(this.modal)
        })
    }

    ensureModal() {
        // ensure modal exists
        this.modal = getEl('feature-detail-modal')
        if (!this.modal) {
            prependToEl(this.parentEl, this.modalTemplate)
            getEl('feature-detail-close-button').addEventListener('click', (e) => { hideEl(this.modal) })
        }
        this.modal = getEl('feature-detail-modal')

        // get main modal areas and clear them
        let metaPane = getEl('feature-detail-meta-pane')
        let dragonPane = getEl('feature-detail-dragon-pane')
        clearEl(metaPane)
        clearEl(dragonPane)

        // size and position modal appropriately
        let topGalleryRect = this.parentEl.getBoundingClientRect()
        //this.modal.style.left = `${topGalleryRect.left}px`
        //this.modal.style.width = `${topGalleryRect.width}px`

        return [metaPane, dragonPane]
    }

    showFeatureDetails(pane, metadataPane=null) {
        let metaPane = metadataPane
        let dragonPane = null
        let targetPage = ''

        if (metaPane === null) [metaPane, dragonPane] = this.ensureModal()
        else {
            clearEl(metaPane)
            let openPane = getElWithQuery('.feature-metadata-pane.visible')
            if (openPane !== null) openPane.classList.remove('visible')
            let showcasedOverlay = getElWithQuery('.feature-overlay.showcased')
            if (showcasedOverlay !== null) showcasedOverlay.classList.remove('showcased')

            targetPage = 'index.html'
        }

        // display details, and show modal
        let feature = this.mv.corpus.getContent('Feature', pane.dataset.id)
        if (feature) {
            let map = this.mv.corpus.getContent('Map', feature.map.id)

            // build tags, events, and places
            let tags = []
            let events = []
            let places = []
            let artists = []
            let printers = []

            if (feature.tags?.length) {
                feature.tags.forEach(tag => {
                    tags.push(`<a href="${this.mv.faceter.buildFilterLink('Tag', tag.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${tag.name}</a>`)
                })
            }
            if (feature.locations?.length) {
                feature.locations.forEach(place => {
                    let regions = []
                    let associatedRegions = this.mv.corpus.getAssociatedContents('Place', place.id, 'Region')
                    associatedRegions.forEach(region => {regions.push(region.name)})

                    places.push(`
                        <a href="${this.mv.faceter.buildFilterLink('Place', place.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${place.name} ${regions.length ? `(${regions.join(', ')})` : ''}</a>
                    `)
                })
            }
            if (feature.events?.length) {
                feature.events.forEach(event => {
                    events.push(`<a href="${this.mv.faceter.buildFilterLink('Event', event.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${event.name}</a>`)
                })
            }
            if (map.artists?.length) {
                map.artists.forEach(artist => {
                    artists.push(`<a href="${this.mv.faceter.buildFilterLink('Person', artist.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${artist.name}</a>`)
                })
            }
            if (map.printers?.length) {
                map.printers.forEach(printer => {
                    printers.push(`<a href="${this.mv.faceter.buildFilterLink('Person', printer.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${printer.name}</a>`)
                })
            }

            appendToEl(metaPane, `
                ${ metadataPane === null ? `
                <div id="feature-detail-title" class="feature-detail-title">${feature.title}</div>
                <!-- map -->
                <div class="feature-detail-metadatum">
                    <div class="feature-detail-metadatum-field">Map</div>
                    <div class="feature-detail-metadatum-value">
                        <a href="map.html?map-id=${map.id}" target="_blank">${map.title}</a>
                    </div>
                </div>
                ` : ''}
                <!-- description -->
                ${ feature.description ? `
                <div class="feature-detail-metadatum${metadataPane === null ? '' : ' values-below'}">
                    <div class="feature-detail-metadatum-field">Description</div>
                    <div class="feature-detail-metadatum-value">${feature.description}</div>
                </div>
                ` : ''}
                <!-- tags -->
                ${ tags.length ? `
                <div class="feature-detail-metadatum${metadataPane === null ? '' : ' values-below'}">
                    <div class="feature-detail-metadatum-field">Tags</div>
                    <div class="feature-detail-metadatum-value">${tags.join('\n')}</div>
                </div>
                ` : ''}
                <!-- unit -->
                ${ metadataPane === null && map.military_unit ? `
                <div class="feature-detail-metadatum${metadataPane === null ? '' : ' values-below'}">
                    <div class="feature-detail-metadatum-field">Unit</div>
                    <div class="feature-detail-metadatum-value">
                        <a href="${this.mv.faceter.buildFilterLink('Unit', map.military_unit.id, false, targetPage)}"${targetPage ? ' target="_blank"' : ''}>${map.military_unit.name}</a>
                    </div>
                </div>
                ` : ''}
                <!-- events -->
                ${ events.length ? `
                <div class="feature-detail-metadatum${metadataPane === null ? '' : ' values-below'}">
                    <div class="feature-detail-metadatum-field">Events</div>
                    <div class="feature-detail-metadatum-value">${events.join('\n')}</div>
                </div>
                ` : ''}
                <!-- places -->
                ${ places.length ? `
                <div class="feature-detail-metadatum${metadataPane === null ? '' : ' values-below'}">
                    <div class="feature-detail-metadatum-field">Places</div>
                    <div class="feature-detail-metadatum-value">${places.join('\n')}</div>
                </div>
                ` : ''}
                ${ metadataPane === null && artists.length ? `
                <!-- artists -->
                <div class="feature-detail-metadatum">
                    <div class="feature-detail-metadatum-field">Artists</div>
                    <div class="feature-detail-metadatum-value">${artists.join('\n')}</div>
                </div>
                ` : '' }
                ${ metadataPane === null && printers.length ? `
                <!-- printers -->
                <div class="feature-detail-metadatum">
                    <div class="feature-detail-metadatum-field">Printers</div>
                    <div class="feature-detail-metadatum-value">${printers.join('\n')}</div>
                </div>
                ` : '' }
            `)

            if (metadataPane === null) {
                let fullURL = new URL('map.html', window.location.href)
                fullURL.search = ''
                this.mv.faceter.createShareButton(
                    getEl('feature-detail-title'),
                    `${fullURL.href}?map-id=${feature.map.id}&feature-id=${feature.id}`,
                    'icon-share-white'
                )

                this.dragon = OpenSeadragon({
                    id: 'feature-detail-dragon-pane',
                    prefixUrl: 'js/openseadragon/images/',
                    tileSources: `${pane.dataset.uri}/info.json`,
                })

                this.dragon.addHandler('open', () => {
                    setTimeout(() => {
                        let region = new OpenSeadragon.Rect(
                            parseInt(pane.dataset.x),
                            parseInt(pane.dataset.y),
                            parseInt(pane.dataset.width),
                            parseInt(pane.dataset.height)
                        )
                        let viewPortRect = this.dragon.viewport.imageToViewportRectangle(region)
                        this.dragon.viewport.fitBounds(viewPortRect)
                    }, 1000)
                })

                showEl(this.modal)
                //this.parentEl.scrollIntoView({behavior: 'smooth', block: 'start'})
            } else {
                metaPane.classList.add('visible')
                setTimeout(() => pane.scrollIntoView({ behavior: 'smooth', block: 'start' }), 500)
                getEl(`feature-overlay-${pane.dataset.id}`).classList.add('showcased')

                let x = parseInt(pane.dataset.x)
                let y = parseInt(pane.dataset.y)
                let width = parseInt(pane.dataset.width)
                let height = parseInt(pane.dataset.height)

                let padding = 20
                let region = new OpenSeadragon.Rect(x, y, width, height)
                let viewportRect = mv.dragon.viewport.imageToViewportRectangle(region)
                let containerWidth = mv.dragon.container.clientWidth
                let viewportWidth = mv.dragon.viewport.getBounds().width
                let paddingInViewport = (padding / containerWidth) * viewportWidth

                mv.dragon.viewport.fitBoundsWithConstraints(new OpenSeadragon.Rect(
                    viewportRect.x - paddingInViewport,
                    viewportRect.y - paddingInViewport,
                    viewportRect.width + (paddingInViewport * 2),
                    viewportRect.height + (paddingInViewport * 2)
                ))
            }
        }
    }

    showRegionMap(regionID) {
        let region = mv.corpus.getContent('Region', regionID)
        let [metaPane, dragonPane] = this.ensureModal()
        let places = mv.corpus.getAssociatedContents('Region', regionID, 'Place')
        let availablePlaces = mv.faceter.filterTracker['Place'].availableValues
        let placesToPlot = []
        let placesList = []

        places.forEach(place => {
            if (availablePlaces.has(place.id) || availablePlaces.size === 0) {
                placesToPlot.push(place)
            }
        })

        placesToPlot.forEach(place => {
            placesList.push(`<a href="${this.mv.faceter.buildFilterLink('Place', place.id)}">${place.name}</a>`)
        })

        appendToEl(metaPane, `
            <div class="feature-detail-title">${region.name}</div>
            
            <div class="feature-detail-metadatum">
                <div class="feature-detail-metadatum-field">Places</div>
                <div class="feature-detail-metadatum-value">${placesList.join('\n')}</div>
            </div>
        `)

        showEl(this.modal)
        setTimeout(() => mv.mapper.pickLocation(dragonPane, regionID, placesToPlot), 800)
    }
}