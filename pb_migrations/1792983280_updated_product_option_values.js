/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("k7d2hwqjniardxo")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "v6spxisg",
    "name": "option",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "rqlqawam1jssejd",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "title"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("k7d2hwqjniardxo")

  // remove
  collection.schema.removeField("v6spxisg")

  return dao.saveCollection(collection)
})
