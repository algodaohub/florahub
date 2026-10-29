/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pm0000000000001",
    "name": "type",
    "type": "select",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSelect": 1,
      "values": [
        "image",
        "video"
      ]
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pm0000000000002",
    "name": "file",
    "type": "file",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "mimeTypes": [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ],
      "thumbs": [
        "240x240"
      ],
      "maxSelect": 1,
      "maxSize": 26214400,
      "protected": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pm0000000000003",
    "name": "poster",
    "type": "file",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "mimeTypes": [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif"
      ],
      "thumbs": [],
      "maxSelect": 1,
      "maxSize": 5242880,
      "protected": false
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pm0000000000004",
    "name": "is_featured",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pm0000000000005",
    "name": "duration",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 0,
      "max": 86400,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // remove
  collection.schema.removeField("pm0000000000001")

  // remove
  collection.schema.removeField("pm0000000000002")

  // remove
  collection.schema.removeField("pm0000000000003")

  // remove
  collection.schema.removeField("pm0000000000004")

  // remove
  collection.schema.removeField("pm0000000000005")

  return dao.saveCollection(collection)
})
