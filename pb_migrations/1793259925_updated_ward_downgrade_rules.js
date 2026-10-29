/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("8g8dg67o22qbsvs")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "psqluetk",
    "name": "new_province",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "lj3o2sd6sdhhyff",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "nak84shz",
    "name": "new_ward",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "8qjq0p4mp5c6kyc",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("8g8dg67o22qbsvs")

  // remove
  collection.schema.removeField("psqluetk")

  // remove
  collection.schema.removeField("nak84shz")

  return dao.saveCollection(collection)
})
