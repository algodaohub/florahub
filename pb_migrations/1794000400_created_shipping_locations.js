/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "shplocs00000001",
    "created": "2026-10-29 00:30:00.000Z",
    "updated": "2026-10-29 00:30:00.000Z",
    "name": "shipping_locations",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "shplprov",
        "name": "provider",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 20, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpltype",
        "name": "type",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["city", "district", "ward"]
        }
      },
      {
        "system": false,
        "id": "shplcode",
        "name": "code",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shplname",
        "name": "name",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 200, "pattern": "" }
      },
      {
        "system": false,
        "id": "shplpar1",
        "name": "parent_code",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shplraw1",
        "name": "raw",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 200000 }
      },
      {
        "system": false,
        "id": "shplsync",
        "name": "synced_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_shipping_locations_unique` ON `shipping_locations` (`provider`, `type`, `code`)",
      "CREATE INDEX `idx_shipping_locations_parent` ON `shipping_locations` (`type`, `parent_code`)",
      "CREATE INDEX `idx_shipping_locations_name` ON `shipping_locations` (`type`, `name`)"
    ],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("shplocs00000001");

  return dao.deleteCollection(collection);
})
