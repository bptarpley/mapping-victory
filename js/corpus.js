class Corpus {
    constructor() {
        this.mv = window.mv
        this.meta = {
            Tag: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                ids: [],
            },
            Event: {
                is_facet: true,
                xRefs: [{field: 'locations', reference: 'Place', multi: true}],
                sortField: 'name',
                ids: []
            },
            Place: {
                is_facet: true,
                xRefs: [{field: 'regions', reference: 'Region', multi: true}],
                sortField: 'name',
                ids: []
            },
            Unit: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                ids: []
            },
            Region: {
                is_facet: true,
                xRefs: [],
                sortField: 'name',
                ids: []
            },
            Person: {
                is_facet: false,
                xRefs: [],
                sortField: 'name',
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
                ids: []
            }
        }
        this.indirectConnections = [
            ['Feature', 'Map', 'Unit'],
            ['Feature', 'Place', 'Region'],
            ['Map', 'Feature', 'Tag'],
            ['Map', 'Feature', 'Event'],
            ['Map', 'Feature', 'Place'],
            ['Map', 'Place', 'Region']
        ]
        this.content = {}
        this.connections = new Set()
    }

    async build(callback) {
        // grab data and populate facets
        let apiCalls = []
        for (let facet in this.meta) {
            if (this.meta[facet].is_facet) apiCalls.push(fetch(`${this.mv.api}/${facet}/?page-size=10000&s_${this.meta[facet].sortField}=asc`))
        }
        let responses = await Promise.all(apiCalls)
        let results = await Promise.all(responses.map(response => response.json()))
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
        if (contentType in this.content) {
            if (id in this.content[contentType]) return this.content[contentType][id]
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
}