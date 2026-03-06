class Gallery {
    constructor(parent, contentType, label, heightRestricted, filters={}, callback=null) {
        this.mv = window.mv
        this.parent = parent
        this.contentType = contentType
        this.defaultFilters = {'page': 1, 'page-size': 10000, 'only': 'id,image_url,title,map.id,tags.id,events.id,locations.id'}
        this.defaultFilters[`s_${this.mv.corpus.meta[contentType].sortField}`] = 'asc'
        this.defaultFilters[`e_${this.mv.corpus.meta[contentType].imageField}`] = 'y'
        this.filters = Object.assign(this.defaultFilters, filters)
        this.label = label
        this.galleryID = 0
        this.borderClasses = ['yellow', 'red', 'blue']
        this.borderClass = 'yellow'
        this.element = getEl(`gallery-${this.galleryID}`)

        // make gallery element
        while (this.element !== null) {
            this.galleryID += 1
            this.element = getEl(`gallery-${this.galleryID}`)
        }
        this.borderClass = this.borderClasses[this.galleryID % this.borderClasses.length]
        appendToEl(parent, `
            <div id="gallery-${this.galleryID}" class="gallery ${this.borderClass}">
                <div class="gallery-header">${this.label} <span id="gallery-${this.galleryID}-count-badge" class="count-badge"></span></div>
                <div class="gallery-container${ heightRestricted ? ' height-restricted' : '' }">
                    <div id="gallery-${this.galleryID}-content" class="gallery-content"></div>
                </div>
            </div>
        `)
        this.element = getEl(`gallery-${this.galleryID}`)
        this.galleryContentDiv = getEl(`gallery-${this.galleryID}-content`)

        // adjust according to content type
        if (contentType === 'Map') {
            this.defaultFilters['only'] = 'iiif_url,title,military_unit.id'
            this.galleryContentDiv.classList.add('map')
        }

        this.paneObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    let pane = entry.target

                    if (!pane.hasAttribute('data-loaded')) {
                        if (this.contentType === 'Map') {
                            callAPI(`${pane.dataset.uri}/info.json`, {}, imgInfo => {
                                pane.dataset.height = imgInfo.height
                                pane.dataset.width = imgInfo.width

                                this.buildImagePane(pane)
                            })
                        }
                        else if (this.contentType === 'Feature') this.buildImagePane(pane)
                    }
                }
            })
        })

        this.imageTemplate = (p) => `
            <div id="gallery-pane-${p.id}" class="gallery-pane${this.contentType === 'Map' ? ' map' : ''}" data-id="${p.id}"
                data-uri="${p.uri}"
                data-x="${p.x}"
                data-y="${p.y}"
                data-width="${p.width}"
                data-height="${p.height}"
                data-title="${escapeAttrVal(p.title)}">
            </div>
        `

        callAPI(`${this.mv.api}/${this.contentType}/`, this.filters, (imgData) => {
            if (imgData.records) {
                getEl(`gallery-${this.galleryID}-count-badge`).innerHTML = imgData.records.length

                imgData.records.forEach((image) => {
                    let imgInfo = extractFeatureDimensions(image[this.mv.corpus.meta[this.contentType].imageField])
                    if (imgInfo !== null) {
                        imgInfo['id'] = image.id
                        imgInfo['title'] = image.title

                        appendToEl(this.galleryContentDiv, this.imageTemplate(imgInfo))

                        this.mv.galleryIDs.add(image.id)
                        image.contentType = this.contentType
                        this.mv.corpus.registerConnections(image)
                    }
                })

                setTimeout(() => forElsMatching('.gallery-pane', (pane) => this.paneObserver.observe(pane)), 1000)
                if (callback !== null) callback()
            }
        })
    }

    buildImagePane(pane) {
        const rect = pane.getBoundingClientRect()
        let divWidth = parseInt(rect.width)
        let divHeight = parseInt(rect.height)
        let maxImageWidth = parseInt(pane.dataset.width)
        let maxImageHeight = parseInt(pane.dataset.height)
        let requestedWidth = divWidth
        let requestedHeight = divHeight
        let regionSpec = 'full'
        let rotation = 0

        if (requestedWidth > maxImageWidth) requestedWidth = maxImageWidth
        if (requestedHeight > maxImageHeight) requestedHeight = maxImageHeight

        let imgSizeSpec = `${requestedWidth},`
        if (maxImageHeight < maxImageWidth) imgSizeSpec = `,${requestedHeight}`

        if (this.contentType === 'Feature') regionSpec = `${pane.dataset.x},${pane.dataset.y},${pane.dataset.width},${pane.dataset.height}`
        else if (this.contentType === 'Map' && maxImageHeight > maxImageWidth) {
            //let ratio = maxImageWidth / requestedWidth
            //let regionHeight = parseInt(ratio * requestedHeight)

            //regionSpec = `0,0,${maxImageWidth},${regionHeight}`
            rotation = 270
        }

        let imgSrc = `${pane.dataset.uri}/${regionSpec}/${imgSizeSpec}/${rotation}/default.jpg`

        pane.innerHTML = `
            <img src="${imgSrc}" alt="${escapeAttrVal(pane.dataset.title)}"></img>
        `

        pane.setAttribute('data-loaded', 'y')
    }
}