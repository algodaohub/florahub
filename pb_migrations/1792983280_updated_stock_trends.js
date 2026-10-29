/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("c1mxakr0y25vna0")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "hzsph7ck",
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
  const collection = dao.findCollectionByNameOrId("c1mxakr0y25vna0")

  // remove
  collection.schema.removeField("hzsph7ck")

  return dao.saveCollection(collection)
})
