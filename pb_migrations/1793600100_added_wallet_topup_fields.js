/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("7ht66w7c25qmde9")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "wtst0001",
    "name": "status",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "wtcd0001",
    "name": "code",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "wtxn0001",
    "name": "sepay_transaction_id",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "wtpd0001",
    "name": "paid_at",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  collection.indexes.push('CREATE INDEX `idx_wallet_tx_code` ON `wallet_transactions` (`code`)')

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("7ht66w7c25qmde9")

  // remove
  collection.schema.removeField("wtst0001")
  collection.schema.removeField("wtcd0001")
  collection.schema.removeField("wtxn0001")
  collection.schema.removeField("wtpd0001")
  collection.indexes = collection.indexes.filter((index) => !index.includes('idx_wallet_tx_code'))

  return dao.saveCollection(collection)
})
