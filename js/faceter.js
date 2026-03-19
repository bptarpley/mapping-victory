class Faceter {
    constructor(parent, targetCT) {
        this.mv = window.mv
        this.parent = parent
        this.targetCT = targetCT
        this.facetLinks = {}
        this.search = null
        this.searchTargetIDs = new Set()
        this.searchTimer = null
        this.filterTracker = {
            Tag: {
                values: new Set(),
                targetIDs: new Set(),
                label: 'Tag'
            },
            Event: {
                values: new Set(),
                targetIDs: new Set(),
                label: 'Event'
            },
            Place: {
                values: new Set(),
                availableValues: new Set(),
                targetIDs: new Set(),
                label: 'Place',
            },
            Unit: {
                values: new Set(),
                targetIDs: new Set(),
                label: 'Unit'
            }
        }

        if (this.parent) {
            this.searchBox = getEl('gallery-search-box')
            this.searchBox.addEventListener('keydown', (e) => {
                clearTimeout(this.searchTimer)
                this.searchTimer = setTimeout(() => {
                    if (this.searchBox.value) {
                        this.performSearch(this.searchBox.value)
                    } else this.search = null
                }, e.key === 'Enter' ? 1 : 1500)
            })
            this.searchBox.addEventListener('focusin', (e) => this.searchBox.setAttribute('placeholder', ''))
            this.searchBox.addEventListener('focusout', (e) => this.searchBox.setAttribute('placeholder', 'Search'))

            document.addEventListener('click', (e) => {
                let link = e.target
                let eventHandled = false

                if (link.closest('.facet-link')) {
                    let facet = link.dataset.facetType
                    let value = link.dataset.facetId

                    if (facet === 'Region') {
                        this.mv.detailer.showRegionMap(value)
                    } else {
                        this.applyFacet(facet, value)
                    }

                    eventHandled = true
                } else if (link.closest('.filter-delete-button')) {
                    let button = link.closest('.filter-delete-button')
                    let facet = button.dataset.facet
                    let value = button.dataset.id

                    this.removeFacet(facet, value)

                    eventHandled = true
                }

                if (eventHandled) {
                    e.preventDefault()
                    getEl('gallery-search-box').scrollIntoView({behavior: 'smooth'})
                }
            })
        }
    }

    performSearch(query) {
        this.search = query
        this.searchTargetIDs.clear()

        callAPI(`${this.mv.api}/${this.targetCT}/`, {q: this.search, only: 'id'}, searchResults => {
            if (searchResults.records) {
                searchResults.records.forEach(hit => {
                    this.searchTargetIDs.add(hit.id)
                })

                // if this is a search on the Maps gallery,
                // let's also search features just in case
                if (this.targetCT === 'Map') {
                    callAPI(`${this.mv.api}/Feature/`, {q: this.search, only: 'map.id'}, searchResults => {
                        if (searchResults.records) {
                            searchResults.records.forEach(hit => {
                                this.searchTargetIDs.add(hit.map.id)
                            })
                        }
                        this.filterGallery()
                    })
                }
                else this.filterGallery()
            }
        })
    }

    buildFacetList(contentType, label) {
        let frequencyMap = {}
        let facetContents = this.mv.corpus.getContents(contentType)
        facetContents.forEach(facetContent => {
            let facetCount = this.mv.corpus.getTotalConnections(contentType, facetContent.id, this.targetCT)
            if (facetCount > 0) frequencyMap[facetContent.id] = facetCount
        })
        let sortedByFrequency = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a])

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
        sortedByFrequency.forEach(facetID => {
            let facet = this.mv.corpus.getContent(contentType, facetID)
            appendToEl(facetListContent, `
                <a href="#" id="facet-link-${contentType}-${facetID}" class="facet-link"
                    data-facet-type="${contentType}"
                    data-facet-id="${facetID}"
                    data-facet-label="${facet.label}">    
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

        forEachKey(this.facetLinks, facetLinkKey => {
            showEl(this.facetLinks[facetLinkKey].link)
            this.facetLinks[facetLinkKey].counter.innerHTML = this.facetLinks[facetLinkKey].totalCount

            let ct = this.facetLinks[facetLinkKey].contentType
            if (!(ct in facetCounter)) facetCounter[ct] = 0
            facetCounter[ct] += 1
        })

        forEachKey(facetCounter, facet => {
            getEl(`facet-list-${facet}-counter`).innerHTML = facetCounter[facet]
        })

        let url = new URL(window.location.href)
        url.search = ''
        window.history.pushState({}, '', url)
    }

    applyFacet(facet, value, showGallery=true) {
        // add the value to this facet
        this.filterTracker[facet].values.add(value)

        // find associated target IDs
        let targetContents = this.mv.corpus.getAssociatedContents(facet, value, this.targetCT)
        let targetContentIDs = new Set(targetContents.map(targetContent => targetContent.id))

        if (this.filterTracker[facet].targetIDs.size)
            this.filterTracker[facet].targetIDs = this.filterTracker[facet].targetIDs.intersection(targetContentIDs)
        else
            this.filterTracker[facet].targetIDs = targetContentIDs

        if (showGallery) this.filterGallery()
    }

    removeFacet(facet, value, showGallery=true) {
        if (facet === 'Search') this.search = null
        else {
            this.filterTracker[facet].values.delete(value)

            // rebuild associated target ids
            this.filterTracker[facet].targetIDs.clear()
            this.filterTracker[facet].values.forEach(facetID => {
                let targetContents = this.mv.corpus.getAssociatedContents(facet, facetID, this.targetCT)
                let targetContentIDs = new Set(targetContents.map(targetContent => targetContent.id))

                if (this.filterTracker[facet].targetIDs.size)
                    this.filterTracker[facet].targetIDs = this.filterTracker[facet].targetIDs.intersection(targetContentIDs)
                else
                    this.filterTracker[facet].targetIDs = targetContentIDs
            })
        }

        if (showGallery) {
            let hasFilters = false
            for (let facet in this.filterTracker) {
                if (this.filterTracker[facet].values.size) {
                    hasFilters = true
                }
            }

            if (hasFilters) this.filterGallery()
            else {
                this.resetFacetList()
                this.mv.showDefaultGalleries()
            }
        }
    }

    filterGallery() {
        let galleryDiv = getEl('galleries')

        clearEl(galleryDiv)
        mv.galleryIDs.clear()

        let g = new Gallery(galleryDiv, this.targetCT, 'Filtered', false, this.buildFilters(), () => {
            let visibleFacetLinks = new Set()
            let facetCounts = {
                Tag: 0,
                Event: 0,
                Region: 0,
                Unit: 0
            }

            // hide all facet links so we can see which ones are relevant
            forEachKey(this.facetLinks, facetLinkKey => {
                hideEl(this.facetLinks[facetLinkKey].link)
                this.facetLinks[facetLinkKey].count = 0
            })

            // remove any "available values" for indirectly determined facets like Place
            forEachKey(this.filterTracker, facet => {
                if (this.filterTracker[facet].hasOwnProperty('availableValues')) {
                    this.filterTracker[facet].availableValues.clear()
                }
            })

            mv.galleryIDs.forEach(targetID => {
                let associatedContent = mv.corpus.getAssociatedContents(this.targetCT, targetID)
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
                                if (this.filterTracker[ct].hasOwnProperty('availableValues')) {
                                    this.filterTracker[ct].availableValues.add(id)
                                }
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

            this.buildFilterLink(null, null, true)
        })
    }

    buildFilters(makeIndicators=true) {
        let filterIndicatorDiv = null
        let bgClasses = ['yellow', 'red', 'blue']
        let filterCounter = 0
        let targetIDSets = []
        let hasFilters = false

        if (makeIndicators) {
            filterIndicatorDiv = getEl('filter-indicator-div')
            clearEl(filterIndicatorDiv)
            this.searchBox.value = ''
        }

        for (let facet in this.filterTracker) {
            if (this.filterTracker[facet].values.size) {
                hasFilters = true
                targetIDSets.push(this.filterTracker[facet].targetIDs)

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
        }

        if (this.search !== null) {
            hasFilters = true
            targetIDSets.push(this.searchTargetIDs)

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
            if (hasFilters) {
                this.createShareButton(filterIndicatorDiv)
                showEl(filterIndicatorDiv)
            }
            else hideEl(filterIndicatorDiv)
        }

        return this.findIntersectingTargetIDs(targetIDSets)
    }

    findIntersectingTargetIDs(targetIDSets) {
        const [first, ...rest] = targetIDSets
        return new Set([...first].filter(id => rest.every(set => set.has(id))))
    }

    createShareButton(parent, url=null, icon='icon-share') {
        if (url === null) url = this.buildFilterLink(null, null, false, window.location.origin)

        appendToEl(parent, `
            <button class="filter-share-button"
                aria-label="Copy share link"
                data-link="${url}"
                data-tippy-content="Copy share link">
                <svg width="30" height="30"><use href="#${icon}"/></svg>
            </button>
        `)
        tippy('.filter-share-button')
        forElsMatching('.filter-share-button', button => {
            button.addEventListener('click', async function(e) {
                let shareButton = e.target.closest('.filter-share-button')
                await navigator.clipboard.writeText(shareButton.dataset.link)
                let toolTip = tippy(shareButton)
                toolTip.setContent('Share link copied!')
                toolTip.show()
            })
        })
    }

    buildFilterLink(facet=null, value=null, changeURL=false, targetPage='') {
        let linkParams = []
        let paramAdded = false

        for (let trackedFacet in this.filterTracker) {
            if (this.filterTracker[trackedFacet].values.size) {
                let facetParams = [...this.filterTracker[trackedFacet].values]
                if (facet === trackedFacet){
                    facetParams.push(value)
                    paramAdded = true
                }
                linkParams.push(`${trackedFacet}=${facetParams.join(',')}`)
            }
        }
        if (!paramAdded && facet !== null) linkParams.push(`${facet}=${value}`)

        if (this.search) linkParams.push(`search=${encodeURIComponent(this.search)}`)

        if (changeURL) {
            let url = new URL(window.location.href)
            url.search = `?${linkParams.join('&')}`
            window.history.pushState({}, '', url)
        }

        return `${targetPage}?${linkParams.join('&')}`
    }

    handlePageLoad(showDefaultGalleries) {
        // now that all facets are built, let's check to see if any GET params
        // were passed in, indicating that we want to filter our gallery immediately
        // on load
        let filteredOnLoad = false
        let filtersAvailableOnLoad = ['Tag', 'Event', 'Place', 'Unit']
        filtersAvailableOnLoad.forEach(filterAvailableOnLoad => {
            if (this.mv.urlParams.has(filterAvailableOnLoad)) {
                let filterValues = this.mv.urlParams.get(filterAvailableOnLoad).split(',')
                filterValues.forEach(val => this.applyFacet(filterAvailableOnLoad, val, false))
                filteredOnLoad = true
            }
        })
        // check for search keywords specifically which will automatically filter the gallery
        if (this.mv.urlParams.has('search')) {
            this.performSearch(this.mv.urlParams.get('search'))
            // or manually filter gallery if other GET params were present
        } else if (filteredOnLoad) {
            this.filterGallery()
            // or just load the default galleries
        } else this.mv.showDefaultGalleries()
    }
}