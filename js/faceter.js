class Faceter {
    constructor(parent) {
        this.mv = window.mv
        this.parent = parent
        this.facetLinks = {}
        this.search = null
        this.searchTimer = null
        this.filterTracker = {
            Tag: {
                getParam: 'f_tags.id',
                values: [],
                availableValues: new Set(),
                label: 'Tag'
            },
            Event: {
                getParam: 'f_events.id',
                values: [],
                availableValues: new Set(),
                label: 'Event'
            },
            Place: {
                getParam: 'f_locations.id',
                values: [],
                availableValues: new Set(),
                label: 'Place',
            }
        }

        this.searchBox = getEl('gallery-search-box')
        this.searchBox.addEventListener('keydown', (e) => {
            clearTimeout(this.searchTimer)
            this.searchTimer = setTimeout(() => {
                if (this.searchBox.value) {
                    this.search = this.searchBox.value
                    this.filterGallery()
                }
                else this.search = null
            }, 1500)
        })
        this.searchBox.addEventListener('focusin', (e) => this.searchBox.setAttribute('placeholder', ''))
        this.searchBox.addEventListener('focusout', (e) => this.searchBox.setAttribute('placeholder', 'Search'))

        document.addEventListener('click', (e) => {
            let link = e.target
            if (link.closest('.facet-link')) {
                let facet = link.dataset.facetType
                let value = link.dataset.facetId

                if (facet === 'Region') {
                    this.mv.mapper.pickLocation(value)
                } else {
                    this.applyFacet(facet, value)
                }
            } else if (link.closest('.filter-delete-button')) {
                let button = link.closest('.filter-delete-button')
                let facet = button.dataset.facet
                let value = button.dataset.id

                this.removeFacet(facet, value)
            }
        })
    }

    buildFacetList(contentType, label, frequencyMap) {
        appendToEl(this.parent, `
            <div class="facet-list">
                <div class="facet-list-header">${label} <span id="facet-list-${contentType}-counter" class="count-badge"></span></div>
                <div id="facet-list-${contentType}-content" class="facet-list-content">
                </div>
            </div>
        `)

        // set facet list count
        getEl(`facet-list-${contentType}-counter`).innerHTML = Object.keys(frequencyMap).length

        // build facet links
        let facetListContent = getEl(`facet-list-${contentType}-content`)
        Object.keys(frequencyMap).forEach(facetID => {
            let facet = this.mv.corpus.getContent(contentType, facetID)
            appendToEl(facetListContent, `
                <a href="#" id="facet-link-${contentType}-${facetID}" class="facet-link"
                    data-facet-type="${contentType}"
                    data-facet-id="${facetID}">    
                    ${facet.label} <span id="facet-link-${contentType}-${facetID}-counter" class="count-badge"></span>
                </a>
            `)

            // store new facet link
            this.facetLinks[`${contentType}-${facetID}`] = {
                link: getEl(`facet-link-${contentType}-${facetID}`),
                counter: getEl(`facet-link-${contentType}-${facetID}-counter`),
                count: frequencyMap[facetID],
                totalCount: frequencyMap[facetID],
                contentType: contentType,
            }

            // set facet link counter
            this.facetLinks[`${contentType}-${facetID}`].counter.innerHTML = frequencyMap[facetID]
        })
    }

    resetFacetList() {
        let facetCounter = {}
        clearEl(getEl('filter-indicator-div'))

        Object.keys(this.facetLinks).forEach(facetLinkKey => {
            showEl(this.facetLinks[facetLinkKey].link)
            this.facetLinks[facetLinkKey].counter.innerHTML = this.facetLinks[facetLinkKey].totalCount

            let ct = this.facetLinks[facetLinkKey].contentType
            if (!(ct in facetCounter)) facetCounter[ct] = 0
            facetCounter[ct] += 1
        })

        Object.keys(facetCounter).forEach(facet => {
            getEl(`facet-list-${facet}-counter`).innerHTML = facetCounter[facet]
        })
    }

    applyFacet(facet, value) {
        this.filterTracker[facet].values.push(value)
        this.filterGallery()
    }

    removeFacet(facet, value) {
        if (facet === 'Search') this.search = null
        else this.filterTracker[facet].values = this.filterTracker[facet].values.filter(val => val !== value)

        if (Object.keys(this.buildFilters(false)).length) this.filterGallery()
        else {
            this.resetFacetList()
            this.mv.showDefaultGalleries()
        }
    }

    filterGallery() {
        let galleryDiv = getEl('gallery-div')

        clearEl(galleryDiv)
        mv.galleryIDs.clear()

        let g = new Gallery(galleryDiv, 'Feature', 'Filtered', false, this.buildFilters(), () => {
            let visibleFacetLinks = new Set()
            let facetCounts = {
                Tag: 0,
                Event: 0,
                Region: 0
            }

            Object.keys(this.facetLinks).forEach(facetLinkKey => {
                hideEl(this.facetLinks[facetLinkKey].link)
                this.facetLinks[facetLinkKey].count = 0
            })

            mv.galleryIDs.forEach(featureID => {
                let associatedContent = mv.corpus.getAssociatedContents('Feature', featureID)
                associatedContent.forEach(content => {
                    let ct = content.contentType
                    let id = content.id

                    if (ct in mv.corpus.meta) {
                        if (mv.corpus.meta[ct].is_facet) {
                            let facetLinkKey = `${ct}-${id}`
                            if (facetLinkKey in this.facetLinks) {
                                if (!visibleFacetLinks.has(facetLinkKey)) {
                                    showEl(this.facetLinks[facetLinkKey].link)
                                    visibleFacetLinks.add(facetLinkKey)
                                    facetCounts[ct] += 1
                                }
                                this.facetLinks[facetLinkKey].count += 1
                            } else if (ct in this.filterTracker) {
                                this.filterTracker[ct].availableValues.add(id)
                            }
                        }
                    }
                })
            })

            visibleFacetLinks.forEach(facetLinkKey => {
                this.facetLinks[facetLinkKey].counter.innerHTML = this.facetLinks[facetLinkKey].count
            })

            Object.keys(facetCounts).forEach(facet => {
                getEl(`facet-list-${facet}-counter`).innerHTML = facetCounts[facet]
            })
        })
    }

    buildFilters(makeIndicators=true) {
        let filters = {}
        let filterIndicatorDiv = null
        let bgClasses = ['yellow', 'red', 'blue']
        let filterCounter = 0

        if (makeIndicators) {
            filterIndicatorDiv = getEl('filter-indicator-div')
            clearEl(filterIndicatorDiv)
            this.searchBox.value = ''
        }

        Object.keys(this.filterTracker).forEach(facet => {
            if (this.filterTracker[facet].values.length) {
                let param = this.filterTracker[facet].getParam
                let value = this.filterTracker[facet].values.join('__')

                //if (value.includes('__')) param += '|'
                filters[param] = value

                if (makeIndicators) {
                    this.filterTracker[facet].values.forEach(val => {
                        let content = this.mv.corpus.getContent(facet, val)
                        appendToEl(filterIndicatorDiv, `
                            <span class="filter-indicator ${bgClasses[filterCounter % bgClasses.length]}">
                                ${this.filterTracker[facet].label}: ${content.label}
                                <button class="filter-delete-button" aria-label="Delete"
                                    data-facet="${facet}" data-id="${val}">
                                    <svg width="14" height="14"><use href="#icon-close"/></svg>
                                </button>
                            </span>
                        `)
                        filterCounter += 1
                    })
                }
            }
        })

        if (this.search !== null) {
            filters['q'] = this.search

            if (makeIndicators) {
                appendToEl(filterIndicatorDiv, `
                <span class="filter-indicator ${bgClasses[filterCounter % bgClasses.length]}">
                    Search: ${this.search}
                    <button class="filter-delete-button" aria-label="Delete"
                        data-facet="Search" data-id="">
                        <svg width="14" height="14"><use href="#icon-close"/></svg>
                    </button>
                </span>
            `)
            }
        }

        if (makeIndicators) {
            if (Object.keys(filters).length) showEl(filterIndicatorDiv)
            else hideEl(filterIndicatorDiv)
        }

        return filters
    }
}