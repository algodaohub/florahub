/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "npovslk7",
    "name": "category",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "pga9hdjhxwqciu7",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "name"
      ]
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "s9si1q4z",
    "name": "seller",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "h4qhdwcx6tqkrs4",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "name"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("3eikh26fbr4q8k1")

  // remove
  collection.schema.removeField("npovslk7")

  // remove
  collection.schema.removeField("s9si1q4z")

  return dao.saveCollection(collection)
})
