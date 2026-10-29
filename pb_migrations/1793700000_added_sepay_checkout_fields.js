/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnlvhbonsg171u2")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "sepay_invoice_number",
    "name": "sepay_invoice_number",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "sepay_order_id",
    "name": "sepay_order_id",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnlvhbonsg171u2")

  // remove
  collection.schema.removeField("sepay_invoice_number")

  // remove
  collection.schema.removeField("sepay_order_id")

  return dao.saveCollection(collection)
})
