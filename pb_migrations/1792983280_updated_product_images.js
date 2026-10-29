/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "c0ikqmoh",
    "name": "product",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "3eikh26fbr4q8k1",
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
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // remove
  collection.schema.removeField("c0ikqmoh")

  return dao.saveCollection(collection)
})
