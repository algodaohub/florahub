/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnwxhvtrgti7n8l")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "p6vvt6gk",
    "name": "flash_sale",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "nsbix0ofe2kcoyr",
      "cascadeDelete": true,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "title"
      ]
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ay8iycqk",
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

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ahac8k3y",
    "name": "variant",
    "type": "relation",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "cbl3d7kuqrnrjw8",
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
  const collection = dao.findCollectionByNameOrId("pnwxhvtrgti7n8l")

  // remove
  collection.schema.removeField("p6vvt6gk")

  // remove
  collection.schema.removeField("ay8iycqk")

  // remove
  collection.schema.removeField("ahac8k3y")

  return dao.saveCollection(collection)
})
