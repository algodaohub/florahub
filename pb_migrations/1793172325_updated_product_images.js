/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "h6f8fdfo",
    "name": "url",
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

  // update
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
        "image/svg+xml",
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

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("9oy9mfno73rqlc3")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "h6f8fdfo",
    "name": "url",
    "type": "text",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  // update
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

  return dao.saveCollection(collection)
})
