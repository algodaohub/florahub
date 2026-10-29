/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("rqlqawam1jssejd")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "3t7smxdm",
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
  const collection = dao.findCollectionByNameOrId("rqlqawam1jssejd")

  // remove
  collection.schema.removeField("3t7smxdm")

  return dao.saveCollection(collection)
})
