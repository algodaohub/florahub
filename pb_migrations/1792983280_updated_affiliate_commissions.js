/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ckb7n8q3ysg3svd")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "st0efgsg",
    "name": "affiliate",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "hodszshy1vujjze",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "code"
      ]
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "oivlapjv",
    "name": "order",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": true,
    "options": {
      "collectionId": "pnlvhbonsg171u2",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "id"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ckb7n8q3ysg3svd")

  // remove
  collection.schema.removeField("st0efgsg")

  // remove
  collection.schema.removeField("oivlapjv")

  return dao.saveCollection(collection)
})
