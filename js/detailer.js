class Detailer {
    constructor() {
        this.mv = window.mv
        this.galleryDiv = getEl('gallery-div')
        this.modal = null
        this.dragon = null

        this.modalTemplate = `
            <div id="feature-detail-modal" class="hidden">
                <div id="feature-detail-controls">
                    <button id="feature-detail-close-button" aria-label="Close">
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
            prependToEl(this.galleryDiv, this.modalTemplate)
            getEl('feature-detail-close-button').addEventListener('click', (e) => { hideEl(this.modal) })
        }
        this.modal = getEl('feature-detail-modal')

        // size and position modal appropriately
        let topGalleryRect = getElWithQuery('.gallery-content').getBoundingClientRect()
        let modalTop = parseInt(topGalleryRect.top)
        this.modal.style.top = `${modalTop}px`
        this.modal.style.left = `${topGalleryRect.left}px`
        this.modal.style.width = `${topGalleryRect.width}px`
        this.modal.style.marginBottom = '-50vh'
    }

    showFeatureDetails(pane) {
        this.ensureModal()

        // fetch data, display details, and show modal
        callAPI(`${this.mv.api}/Feature/?f_id=${pane.dataset.id}`, {}, featureData => {
            if (featureData.records) {
                let feature = featureData.records[0]

                // get meta and dragon panes
                let metaPane = getEl('feature-detail-meta-pane')
                let dragonPane = getEl('feature-detail-dragon-pane')

                console.log(feature)

                // build tags, events, and places
                let tags = []
                let events = []
                let places = []

                if (feature.tags?.length) {
                    feature.tags.forEach(tag => {
                        tags.push(`<a href="/?Tag=${tag.id}">${tag.name}</a>`)
                    })
                }
                if (feature.locations?.length) {
                    feature.locations.forEach(place => {
                        let regions = []
                        let associatedRegions = this.mv.corpus.getAssociatedContents('Place', place.id, 'Region')
                        associatedRegions.forEach(region => {regions.push(region.name)})

                        places.push(`
                            <a href="/?Place=${place.id}">${place.name} ${regions.length ? `(${regions.join(', ')})` : ''}</a>
                        `)
                    })
                }
                if (feature.events?.length) {
                    feature.events.forEach(event => {
                        events.push(`<a href="/?Event=${event.id}">${event.name}</a>`)
                    })
                }

                clearEl(metaPane)
                appendToEl(metaPane, `
                    <div class="feature-detail-title">${feature.title}</div>
                    <!-- map -->
                    <div class="feature-detail-metadatum">
                        <div class="feature-detail-metadatum-field">Map</div>
                        <div class="feature-detail-metadatum-value">
                            <a href="/map.html?id=${feature.map.id}" target="_blank">${feature.map.title}</a>
                        </div>
                    </div>
                    <!-- description -->
                    <div class="feature-detail-metadatum">
                        <div class="feature-detail-metadatum-field">Description</div>
                        <div class="feature-detail-metadatum-value">${feature.description}</div>
                    </div>
                    <!-- tags -->
                    ${ tags.length ? `
                    <div class="feature-detail-metadatum">
                        <div class="feature-detail-metadatum-field">Tags</div>
                        <div class="feature-detail-metadatum-value">${tags.join('\n')}</div>
                    </div>
                    ` : ''}
                    <!-- events -->
                    ${ events.length ? `
                    <div class="feature-detail-metadatum">
                        <div class="feature-detail-metadatum-field">Events</div>
                        <div class="feature-detail-metadatum-value">${events.join('\n')}</div>
                    </div>
                    ` : ''}
                    <!-- places -->
                    ${ places.length ? `
                    <div class="feature-detail-metadatum">
                        <div class="feature-detail-metadatum-field">Places</div>
                        <div class="feature-detail-metadatum-value">${places.join('\n')}</div>
                    </div>
                    ` : ''}
                `)

                clearEl(dragonPane)
                this.dragon = OpenSeadragon({
                    id: 'feature-detail-dragon-pane',
                    prefixUrl: '/js/openseadragon/images/',
                    tileSources: `${pane.dataset.uri}/info.json`
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
            }
        })
    }

    showRegionMap(regionID) {

    }
}