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
                xRefs: [{field: 'locations', reference: 'Place', via: null, multi: true}],
                sortField: 'name',
                ids: []
            },
            Place: {
                is_facet: true,
                xRefs: [{field: 'regions', reference: 'Region', via: null, multi: true}],
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
                is_facet: false,
                xRefs: [
                    {field: 'artists', reference: 'Person', via: null, multi: true},
                    {field: 'printers', reference: 'Person', via: null, multi: true},
                ],
                sortField: 'title',
                ids: []
            },
            Feature: {
                is_facet: false,
                xRefs: [
                    {field: 'tags', reference: 'Tag', via: null, multi: true},
                    {field: 'events', reference: 'Event', via: null, multi: true},
                    {field: 'locations', reference: 'Place', via: null, multi: true},
                    {field: 'locations', reference: 'Region', via: 'Place', multi: true},
                    {field: 'referenced_people', reference: 'Person', via: null, multi: true},
                ],
                sortField: 'title',
                imageField: 'image_url',
                titleField: 'title',
                ids: []
            }
        }
        this.content = {}
        this.connections = {}
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
                })
            }
        })

        // wire up any xrefs
        Object.keys(this.meta).forEach(facet => {
            if (this.meta[facet].is_facet) {
                let contents = this.getContents(facet)
                contents.forEach(content => {
                    this.registerConnections(content)
                })
            }
        })

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
        let keyFragment = `${contentType}-${id}`

        Object.keys(mv.corpus.connections).forEach(connectionKey => {
            let matchFound = false

            if (connectionKey.includes(keyFragment)) {
                if (associatedContentType !== null) {
                    if (connectionKey.includes(`${associatedContentType}-`)) {
                        matchFound = true
                    }
                } else matchFound = true
            }

            if (matchFound) {
                let associatedKeyFragment = connectionKey.replace(keyFragment, '').replace('--', '')
                let [associatedContentType, associatedID] = associatedKeyFragment.split('-')
                let content = this.getContent(associatedContentType, associatedID)
                if (content !== null) associatedContents.push(content)
            }
        })

        return associatedContents
    }

    buildConnectionKey(contentType_a, id_a, contentType_b, id_b) {
        let connectionKeyParts = [`${contentType_a}-${id_a}`, `${contentType_b}-${id_b}`]
        connectionKeyParts.sort()
        return connectionKeyParts.join('--')
    }

    registerConnections(content) {
        if (content.contentType in this.meta) {
            this.meta[content.contentType].xRefs.forEach(xRef => {
                if (xRef.field in content) {
                    if (xRef.multi) {
                        content[xRef.field].forEach(val => {
                            if (val.id) {
                                if (xRef.via === null) {
                                    let connectionKey = this.buildConnectionKey(
                                        content.contentType,
                                        content.id,
                                        xRef.reference,
                                        val.id
                                    )
                                    this.connections[connectionKey] = true
                                } else {
                                    let indirectContents = this.getAssociatedContents(xRef.via, val.id, xRef.reference)
                                    indirectContents.forEach(c => {
                                        let connectionKey = this.buildConnectionKey(
                                            content.contentType,
                                            content.id,
                                            xRef.reference,
                                            c.id
                                        )
                                        this.connections[connectionKey] = true
                                    })
                                }
                            }
                        })
                    } else if (content[xRef.field].id) {
                        if (xRef.via === null) {
                            let connectionKey = this.buildConnectionKey(
                                content.contentType,
                                content.id,
                                xRef.reference,
                                content[xRef.field].id
                            )
                            this.connections[connectionKey] = true
                        } else {
                            let indirectContents = this.getAssociatedContents(xRef.via, content[xRef.field].id, xRef.reference)
                            indirectContents.forEach(c => {
                                let connectionKey = this.buildConnectionKey(
                                    content.contentType,
                                    content.id,
                                    xRef.reference,
                                    c.id
                                )
                                this.connections[connectionKey] = true
                            })
                        }
                    }
                }
            })
        }
    }

    showConnectionStats() {
        let conns = {}

        Object.keys(this.connections).forEach(key => {
            const match = key.match(/([^-]*)-[^-]*--([^-]*)-[^-]*/)
            if (match) {
                let con = `${match[1]}-${match[2]}`
                if (!(con in conns)) conns[con] = 0
                conns[con] += 1
            }
        })

        return conns
    }
}