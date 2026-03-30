class Corpus {
    constructor() {
        this.mv = window.mv
        this.meta = {
            Tag: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                criteria: {},
                ids: [],
            },
            Event: {
                is_facet: true,
                xRefs: [{field: 'locations', reference: 'Place', multi: true}],
                sortField: 'name',
                criteria: {},
                ids: []
            },
            Place: {
                is_facet: true,
                xRefs: [{field: 'regions', reference: 'Region', multi: true}],
                sortField: 'name',
                criteria: {},
                ids: []
            },
            Unit: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                criteria: {},
                ids: []
            },
            Region: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                criteria: {},
                ids: []
            },
            Person: {
                is_facet: false,
                xRefs: [],
                sortField: 'name',
                criteria: {},
                ids: []
            },
            Map: {
                is_facet: true,
                xRefs: [
                    {field: 'artists', reference: 'Person', multi: true},
                    {field: 'printers', reference: 'Person', multi: true},
                    {field: 'military_unit', reference: 'Unit', multi: false},
                ],
                sortField: 'title',
                imageField: 'iiif_url',
                titleField: 'title',
                criteria: {'f_published': 'true'},
                ids: []
            },
            Feature: {
                is_facet: true,
                xRefs: [
                    {field: 'map', reference: 'Map', multi: false},
                    {field: 'tags', reference: 'Tag', multi: true},
                    {field: 'events', reference: 'Event', multi: true},
                    {field: 'locations', reference: 'Place', multi: true},
                    {field: 'referenced_people', reference: 'Person', multi: true},
                ],
                sortField: 'title',
                imageField: 'image_url',
                titleField: 'title',
                criteria: {},
                ids: []
            }
        }
        this.indirectConnections = [
            ['Feature', 'Map', 'Unit'],
            ['Feature', 'Place', 'Region'],
            ['Feature', 'Map', 'Person'],
            ['Map', 'Feature', 'Tag'],
            ['Map', 'Feature', 'Event'],
            ['Map', 'Feature', 'Place'],
            ['Map', 'Place', 'Region']
        ]
        this.content = {}
    }

    async build(callback, useCache=true) {
        // grab data and populate facets
        let apiRequests = []
        for (let facet in this.meta) {
            if (this.meta[facet].is_facet) {
                let criteria = Object.assign({}, this.meta[facet].criteria, {
                    'page-size': 10000,
                })
                criteria[`s_${this.meta[facet].sortField}`] = 'asc'
                apiRequests.push({
                    facet,
                    url: `${this.mv.api}/${facet}/?${buildGetParams(criteria)}`
                })
            }
        }

        const db = await this.#openDB()

        let results = await Promise.all(apiRequests.map(async ({ facet, url }) => {
            // Kick off the cache read and last-updated check in parallel
            const cachedRecordPromise = db ? this.#dbGet(db, facet) : Promise.resolve(null)
            const lastUpdatedPromise = fetch(`${this.mv.api}/${facet}/last-updated/`).then(r => r.json())
            const [cachedRecord, lastUpdatedResponse] = await Promise.all([cachedRecordPromise, lastUpdatedPromise])

            // Serve from cache if it exists and is still fresh
            const cacheIsValid = cachedRecord && cachedRecord.last_updated >= lastUpdatedResponse.last_updated
            if (db && useCache && cacheIsValid) return cachedRecord.data

            // Cache is stale or bypassed -- fetch fresh data from the API
            const response = await fetch(url)
            const data = await response.json()

            // Store fresh data in the cache for next time (non-blocking)
            if (db) this.#dbPut(db, facet, { last_updated: lastUpdatedResponse.last_updated, data }).catch(err => console.warn(`Failed to cache ${facet}:`, err))

            return data
        }))
        results.forEach(result => {
            if (result.meta && result.records) {
                let facet = result.meta.content_type
                if (!(facet in this.content)) this.content[facet] = {}

                result.records.forEach(record => {
                    this.meta[facet].ids.push(record.id)
                    this.content[facet][record.id] = record
                    this.content[facet][record.id]['contentType'] = facet
                    this.content[facet][record.id]['_conns'] = {}
                })
            }
        })

        // wire up any xrefs
        forEachKey(this.meta, facet => {
            if (this.meta[facet].is_facet) {
                let contents = this.getContents(facet)
                contents.forEach(content => {
                    this.registerConnections(content)
                })
            }
        })

        // wire up indirect connections
        this.registerIndirectConnections()

        callback()
    }

    getContent(contentType, id) {
        // for content that gets fully loaded because it's a facet
        if (contentType in this.content) {
            if (id in this.content[contentType]) return this.content[contentType][id]
        }

        // for content that isn't a facet but should be interlinked anyway
        if (contentType in this.meta) {
            if (!this.meta[contentType].is_facet) {
                if (!(contentType in this.content)) this.content[contentType] = {}
                this.content[contentType][id] = {
                    id: id,
                    contentType: contentType,
                    label: contentType,
                    _conns: {}
                }
            }

            return this.content[contentType][id]
        }

        return null
    }

    getContents(contentType) {
        let results = []
        if (contentType in this.meta) {
            this.meta[contentType].ids.forEach(id => {
                results.push(this.getContent(contentType, id))
            })
        }
        return results
    }

    getAssociatedContents(contentType, id, associatedContentType=null) {
        let associatedContents = []
        let content = this.getContent(contentType, id)
        if (content) {
            forEachKey(content._conns, connectedContentType => {
                if (connectedContentType === associatedContentType || associatedContentType === null) {
                    content._conns[connectedContentType].forEach(connectedContentID => {
                        associatedContents.push(this.getContent(connectedContentType, connectedContentID))
                    })
                }
            })
        }
        return associatedContents
    }

    makeConnection(contentType_a, id_a, contentType_b, id_b) {
        let contentA = this.getContent(contentType_a, id_a)
        let contentB = this.getContent(contentType_b, id_b)

        if (contentA && contentB) {
            if (!(contentB.contentType in contentA._conns)) contentA._conns[contentB.contentType] = new Set()
            if (!(contentA.contentType in contentB._conns)) contentB._conns[contentA.contentType] = new Set()

            contentA._conns[contentB.contentType].add(contentB.id)
            contentB._conns[contentA.contentType].add(contentA.id)
        }
    }

    registerConnections(content) {
        if (content.contentType in this.meta) {
            this.meta[content.contentType].xRefs.forEach(xRef => {
                if (xRef.field in content) {
                    if (xRef.multi) {
                        content[xRef.field].forEach(val => {
                            if (val.id) {
                                this.makeConnection(
                                    content.contentType,
                                    content.id,
                                    xRef.reference,
                                    val.id
                                )
                            }
                        })
                    } else if (content[xRef.field].id) {
                        this.makeConnection(
                            content.contentType,
                            content.id,
                            xRef.reference,
                            content[xRef.field].id
                        )
                    }
                }
            })
        }
    }

    registerIndirectConnections() {
        this.indirectConnections.forEach(triple => {
            let rootCT = triple[0]
            let mediatingCT = triple[1]
            let leafCT = triple[2]

            let rootContents = this.getContents(rootCT)
            rootContents.forEach(rootContent => {
                let mediatingContents = this.getAssociatedContents(rootCT, rootContent.id, mediatingCT)
                mediatingContents.forEach(mediatingContent => {
                    let leafContents = this.getAssociatedContents(mediatingCT, mediatingContent.id, leafCT)
                    leafContents.forEach(leafContent => {
                        this.makeConnection(rootCT, rootContent.id, leafCT, leafContent.id)
                    })
                })
            })
        })
    }

    getTotalConnections(contentTypeA, contentIDA, contentTypeB) {
        let total = 0
        let content = this.getContent(contentTypeA, contentIDA)
        if (content) {
            if (contentTypeB in content._conns) {
                total = content._conns[contentTypeB].size
            }
        }
        return total
    }

    #openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('mv_corpus', 1)
            request.onupgradeneeded = e => {
                e.target.result.createObjectStore('responses', { keyPath: 'facet' })
            }
            request.onsuccess = e => resolve(e.target.result)
            request.onerror = e => reject(e.target.error)
        }).catch(() => null)
    }

    #dbGet(db, facet) {
        return new Promise((resolve, reject) => {
            const request = db.transaction('responses', 'readonly')
                .objectStore('responses')
                .get(facet)
            request.onsuccess = e => resolve(e.target.result ?? null)
            request.onerror = e => reject(e.target.error)
        })
    }

    #dbPut(db, facet, payload) {
        return new Promise((resolve, reject) => {
            const request = db.transaction('responses', 'readwrite')
                .objectStore('responses')
                .put({ facet, ...payload })
            request.onsuccess = () => resolve()
            request.onerror = e => reject(e.target.error)
        })
    }
}